/**
 * Copyright 2019 Carnegie Technologies
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Migrator class
 */

import * as walk from 'klaw-sync';
import * as path from 'path';

import { config } from './config';
import { CassandraClient } from './lib/CassandraClient';
import * as logger from './lib/Logger';
import * as lock from './models/Lock';

import { Bootstrap } from './models/Bootstrap';
import { Init } from './models/Init';
import { Migration } from './models/Migration';

/**
 * The Migrator class. The start() function on this class is the entry point to
 * starting a migration
 */
export class Migrator {
    /**
     * Map of migrations keyed by the service they belong to
     */
    protected migrations: Map<string, Migration[]>;

    /**
     * Bootstrap files
     */
    protected bootstraps: Bootstrap[];

    /**
     * Init file
     */
    protected initFile: Init;

    public constructor() {
        this.migrations = new Map<string, Migration[]>();
        this.bootstraps = [];
    }

    /**
     * Starts the migrator. Performs the following steps:
     * 1) Run the init file
     * 2) Acquire the lock
     * 3) Load all bootstraps and migration files
     * 4) Apply the bootstraps
     * 5) Apply the migrations
     * 6) Release the lock
     */
    public async start(): Promise<void> {
        try {
            await this.init();

            if (!await lock.acquire()) {
                throw new Error('Failed to acquire lock, can not continue');
            }
        }
        catch (error) {
            logger.error({ message: 'Error preparing for migration', error });
            process.exit(1);
        }

        try {
            logger.info({ message: 'Lock acquired' });

            await this.loadFiles();

            await this.applyBootstraps();

            await this.applyMigrations();
        }
        catch (error) {
            logger.error({
                message: 'Error during migration.',
                error
            });

            await this.releaseLockAndExit(1);
        }

        await this.releaseLockAndExit();
    }

    /**
     * Release the migration lock and then exit with the given status code.
     */
    private async releaseLockAndExit(code?: number): Promise<void> {
        const unlocked: boolean = await lock.release();
        if (!unlocked) {
            logger.error({ message: 'Failed to release lock, manual recovery may be required' });
            return;
        }
        else {
            logger.info({ message: 'Lock released' });
        }

        process.exit(code);
    }

    /**
     * Loads and applies the init file. This file sets up the required
     * cqlmigrate keyspace and tables, and so this function needs to be the
     * first thing run in this program.
     */
    private async init(): Promise<void> {
        this.initFile = new Init(config.get('migrationDirectory') + '/' + config.get('initFilename'));

        try {
            await this.initFile.init();
        }
        catch (error) {
            throw new Error('Error loading init file: ' + error.message);
        }

        logger.info({ message: 'Applying init file' });

        try {
            await this.initFile.apply();
        }
        catch (error) {
            throw new Error('Error applying the init file: ' + error.message);
        }

        logger.info({ message: 'Init file applied' });
    }

    /**
     * Applies all bootstraps. These can be run in any order and in parallel,
     * and will attempt to apply even if they have been previously applied. The
     * function waits for schema agreement before resolving.
     */
    private async applyBootstraps(): Promise<void> {
        logger.info({ message: 'Applying bootstraps' });

        await Promise.all(this.bootstraps.map(async (bootstrap: Bootstrap): Promise<void> => {
            try {
                await bootstrap.apply();
            }
            catch (error) {
                logger.error({
                    message: 'Error applying bootstrap; exiting',
                    error,
                    keyspace: bootstrap.keyspace,
                    file: bootstrap.file
                });

                throw error;
            }
        }));

        logger.info({ message: 'Bootstraps applied, waiting for schema agreement before continuing' });
        await CassandraClient.GET_INSTANCE('').getSchemaAgreementPromise();
        logger.info({ message: 'Schemas are in agreement, continuing' });
    }

    /**
     * Applies all migrations (previously applied migrations won't re-apply).
     * See the inner comment for details on this process.
     */
    private async applyMigrations(): Promise<void> {
        // Whether or not a migration has failed. This flag is used so we can
        // run migrations in parallel, but not exit on error until the current
        // round of migrations is complete.
        let migrationFailed: boolean = false;

        logger.info({ message: 'Applying migrations' });

        // To apply migrations, we loop while something still exists in the
        // migrations map. On each pass, we take the first element from each
        // value (in other words, the next migration for each service), remove
        // the element, and apply it. If there are no elements left we delete
        // the key from the map. All migrations applied on each pass can be done
        // in parallel, but we have to wait until they are all done before
        // moving on to the next pass.
        while ([...this.migrations.keys()].length > 0) {
            await Promise.all([...this.migrations.values()].map(async (migrations: Migration[]): Promise<void> => {
                const migration: Migration = migrations.shift();

                if (migrations.length === 0) {
                    this.migrations.delete(migration.service);
                }

                logger.info({
                    message: 'Applying migration',
                    keyspace: migration.keyspace,
                    service: migration.service,
                    file: migration.file
                });

                try {
                    await migration.apply();
                }
                catch (error) {
                    logger.error({
                        message: 'Error applying migration. Admin intervention is likely required.',
                        error,
                        keyspace: migration.keyspace,
                        service: migration.service,
                        file: migration.file
                    });

                    migrationFailed = true;
                }
            }));

            if (migrationFailed) {
                throw new Error('Round of migrations failed');
            }

            logger.info({ message: 'Round of migrations applied, waiting for schema agreement before continuing' });
            await CassandraClient.GET_INSTANCE('').getSchemaAgreementPromise();
            logger.info({ message: 'Schemas are in agreement, continuing' });
        }
    }

    /**
     * Loads all of the cql files (bootstraps and migrations), finds any
     * associated migrations in the datastore, and sorts the files per service
     * in lexical order.
     */
    private async loadFiles(): Promise<void> {
        for (const file of this.getFilePaths(config.get('migrationDirectory'))) {
            const bootstrapDepth: number = 1;
            const migrationDepth: number = 2;

            if (path.basename(file.path) === config.get('bootstrapFilename') &&
                this.getFileDepth(file.path) === bootstrapDepth) {
                const bootstrap: Bootstrap = new Bootstrap(file.path);
                await bootstrap.init();
                this.bootstraps.push(bootstrap);
            }
            else if (this.getFileDepth(file.path) === migrationDepth) {
                const migration: Migration = new Migration(file.path);
                await migration.init();

                if (migration.success === false && migration.appliedOn != null) {
                    const error: Error = new Error('Migration found with success=false. This means the previous ' +
                        'migration attempt failed and manual intervention is required');

                    logger.error({
                        message: error.message,
                        keyspace: migration.keyspace,
                        service: migration.service,
                        file: migration.file
                    });

                    throw error;
                }

                if (!this.migrations.has(migration.service)) {
                    this.migrations.set(migration.service, []);
                }

                this.migrations.get(migration.service).push(migration);
            }
        }

        for (const migrations of this.migrations.values()) {
            migrations.sort((a: Migration, b: Migration): number => {
                if (a.file < b.file) {
                    return -1;
                }
                if (a.file > b.file) {
                    return 1;
                }
                return 0;
            });
        }

        logger.info({
            message: 'Files loaded',
            bootstraps: this.bootstraps.length,
            migrations: [].concat(...this.migrations.values()).length
        });
    }

    /**
     * Performs a walk of the schemas directory and returns a list of file paths
     * found
     */
    private getFilePaths(searchDirectory: string): walk.Item[] {
        logger.info({ message: 'Searching for cql files', searchDirectory });

        // This package has a few weird things, but still seemed to be the best
        // options. It returns a ReadonlyArray, so we just copy it back to a
        // regular array. The typings are also out of date for the options, so
        // we have to cast them to 'object' to be able to pass in the correct
        // fields.
        const files: walk.Item[] = [...walk(
            searchDirectory,
            {
                nodir: true,
                filter: (item: walk.Item): boolean => { return path.extname(item.path) === '.cql'; }
            } as object
        )];

        logger.info({ message: `Found ${files.length} cql files` });

        return files;
    }

    /**
     * Returns the depth of the given file path relative to the root migration
     * directory
     */
    private getFileDepth(filePath: string): number {
        return path.relative(config.get('migrationDirectory'), filePath).split(path.sep).length - 1;
    }
}
