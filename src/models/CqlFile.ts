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
 * Base model for cql files (migrations and bootstraps)
 */

import { types } from 'cassandra-driver';

import { config } from '../config';
import { CassandraClient } from '../lib/CassandraClient';
import { SavableBase } from '../lib/SavableBase';
import { canonicalizeCql } from '../lib/util';

import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Common columns for anything extending CqlFile
 */
export interface CqlFileRow {
    keyspace_name?: string;
    file?: string;
    body?: string;
    applied_on?: Date;
    success?: boolean;
}

/**
 * CqlFile model
 */
export abstract class CqlFile extends SavableBase {
    /**
     * The keyspace this CQL file is for
     */
    public keyspace: string;

    /**
     * The file name. This does *not* include the path
     */
    public file: string;

    /**
     * The timestamp of when this file was applied on
     */
    public appliedOn: Date;

    /**
     * Whether or not applying the file succeeded
     */
    public success: boolean;

    /**
     * The absolute path to the file
     */
    protected filePath: string;

    /**
     * The path to the file, relative to the root migration directory
     */
    protected relativePath: string;

    /**
     * The body of the CQL file. This should be in canonical form at the time it
     * is loaded
     */
    protected fileBody: string;

    public constructor(filePath: string) {
        super();

        this.filePath = filePath;
        this.relativePath = path.relative(config.get('migrationDirectory'), filePath);

        this.appliedOn = null;
        this.success = false;
    }

    /**
     * Reads the file from disk
     */
    public async init(): Promise<void> {
        await this.loadAndCanonicalizeFile();
    }

    /**
     * Applies a file. It first saves to the datastore with appliedOn set to the
     * current timestamp, and success set to false. After executing each command
     * in the file body, it will save again to the datastore with an updated
     * timestamp and success set to true.
     */
    public async apply(): Promise<void> {
        this.appliedOn = new Date();
        await this.save();

        for (const command of this.fileBody.split(';')) {
            // Make sure we don't try to execute any strings with just
            // whitespace. In theory this should only be the last element in the
            // array, but it seems safer to check every single element instead
            // of popping off the last element.
            if (!/^[\s]*$/.test(command)) {
                await CassandraClient
                    .GET_INSTANCE('')
                    .execute(command, [], {
                        readTimeout: config.get('migrationClientTimeoutMs'),
                        consistency: types.consistencies.all
                    });
            }
        }

        this.appliedOn = new Date();
        this.success = true;

        await this.save();
    }

    /**
     * Loads the file from the file system and immediately puts it into the
     * canonical form before storing it
     */
    protected async loadAndCanonicalizeFile(): Promise<void> {
        this.fileBody = canonicalizeCql((await fs.readFile(this.filePath)).toString());
    }
}
