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
 * Init model. This is a special file for initializing the keyspace and tables
 * that this tool needs. It doesn't actually save anything, but due to the lack
 * of multiple inheritance it is easiest to just extend CqlFile and overwrite
 * the save function.
 */

import { CqlFile, CqlFileRow } from './CqlFile';

/**
 * Model for a init file
 */
export class Init extends CqlFile {
    protected readonly KEYSPACE_NAME: string = null;

    protected readonly TABLE_NAME: string = null;

    protected readonly SCHEMA_FOLDER: string = null;

    protected readonly SCHEMA_NAME: string = null;

    public async save(): Promise<object> {
        return;
    }

    protected getInsertableObject(): CqlFileRow {
        return;
    }
}
