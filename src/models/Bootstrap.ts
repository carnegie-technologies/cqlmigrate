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
 * Bootstrap model
 */

import { CqlFile, CqlFileRow } from './CqlFile';

import * as path from 'path';

const keyspace: string = 'cqlmigrate';
const table: string = 'bootstraps';

/**
 * Model for a bootstrap file
 */
export class Bootstrap extends CqlFile {
    protected readonly KEYSPACE_NAME: string = keyspace;

    protected readonly TABLE_NAME: string = table;

    protected readonly SCHEMA_FOLDER: string = 'schemas';

    protected readonly SCHEMA_NAME: string = 'bootstrap';

    public constructor(filePath: string) {
        super(filePath);

        // Index positions for extracting fields from a path in the form
        // {keyspace}/{file}
        const keyspaceIndex: number = 0;
        const fileIndex: number = 1;

        const fields: string[] = this.relativePath.split(path.sep);

        this.keyspace = fields[keyspaceIndex];
        this.file = fields[fileIndex];
    }

    protected getInsertableObject(): CqlFileRow {
        return {
            keyspace_name: this.keyspace,
            applied_on: this.appliedOn,
            file: this.file,
            body: this.fileBody,
            success: this.success
        };
    }
}
