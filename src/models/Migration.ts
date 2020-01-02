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
 * Migration model
 */

import { types } from 'cassandra-driver';

import * as path from 'path';

import { CassandraClient } from '../lib/CassandraClient';
import * as logger from '../lib/Logger';
import { CqlFile, CqlFileRow } from './CqlFile';

import { getCqlChecksum } from '../lib/util';

const keyspace: string = 'cqlmigrate';
const table: string = 'migrations';

interface MigrationRow extends CqlFileRow {
    service?: string;
    checksum?: string;
}

/**
 * Model for migrations
 */
export class Migration extends CqlFile {
    public service: string;

    public checksum: string;

    protected readonly KEYSPACE_NAME: string = keyspace;

    protected readonly TABLE_NAME: string = table;

    protected readonly SCHEMA_FOLDER: string = 'schemas';

    protected readonly SCHEMA_NAME: string = 'migration';

    public constructor(filePath: string) {
        super(filePath);

        // Index positions for extracting fields from a path in the form
        // {keyspace}/{service}/{file}
        const keyspaceIndex: number = 0;
        const serviceIndex: number = 1;
        const fileIndex: number = 2;

        const fields: string[] = this.relativePath.split(path.sep);

        this.keyspace = fields[keyspaceIndex];
        this.service = fields[serviceIndex];
        this.file = fields[fileIndex];

        this.checksum = null;
    }

    /**
     * Inits the same as its parent class, and then checks the datastore to find
     * any associated migration that has already been saved. The saved migration
     * is loaded into this object if it is found.
     */
    public async init(): Promise<void> {
        await super.init();
        await this.fillFromDatastoreIfExists();
    }

    /**
     * Applies the same as its parent class, but first calculates the checksum and
     * verifies it hasn't changed if it already existed.
     */
    public async apply(): Promise<void> {
        if (this.success === true) {
            if (this.checksum !== getCqlChecksum(this.fileBody)) {
                logger.error({
                    message: 'Existing hash does not match hash of current file body',
                    keyspace: this.keyspace,
                    service: this.service,
                    file: this.file
                });

                throw new Error('Existing hash does not match hash of current file body');
            }

            logger.info({
                message: 'Migration has already been applied... skipping',
                keyspace: this.keyspace,
                service: this.service,
                file: this.file
            });

            return;
        }

        this.checksum = getCqlChecksum(this.fileBody);

        await super.apply();

        logger.info({
            message: 'Migration applied',
            keyspace: this.keyspace,
            service: this.service,
            file: this.file
        });
    }

    /**
     * Checks the datastore if this migration already exists. If it does, it is
     * loaded into this object.
     */
    protected async fillFromDatastoreIfExists(): Promise<void> {
        const results: types.ResultSet = await CassandraClient.GET_INSTANCE(keyspace).execute(
            `SELECT * FROM ${table} WHERE keyspace_name = ? AND service = ? AND file = ?`,
            [this.keyspace, this.service, this.file],
            { consistency: types.consistencies.all }
        );

        const row: MigrationRow = results.first() as MigrationRow;

        if (row != null) {
            this.appliedOn = row.applied_on;
            this.checksum = row.checksum;
            this.success = row.success;
        }
    }

    protected getInsertableObject(): MigrationRow {
        return {
            keyspace_name: this.keyspace,
            service: this.service,
            file: this.file,
            body: this.fileBody,
            applied_on: this.appliedOn,
            checksum: this.checksum,
            success: this.success
        };
    }
}
