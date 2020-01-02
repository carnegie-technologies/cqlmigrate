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

import { CassandraClient } from './CassandraClient';

/**
 * Base class for objects savable to Cassandra. Specifies the table the object
 * belongs to, what the database representation of the object is, and provides
 * a utility save function.
 */
abstract class SavableBase {
    /**
     * The name of the keyspace where objects are stored
     */
    protected abstract readonly KEYSPACE_NAME: string;

    /**
     * The table name to store the object into. To store a specific object in a different table, override this property
     * in the child object
     */
    protected abstract readonly TABLE_NAME: string;

    /**
     * The TTL for records of this type (in seconds). Setting it to 0 means this record doesn't expire.
     * Child classes can override this to set a TTL for the specific objects they handle.
     */
    protected readonly TTL: number = 0;

    /**
     * Saves the object to the data store
     */
    public async save(): Promise<object> {
        return CassandraClient.GET_INSTANCE(this.KEYSPACE_NAME).insert(
            this.TABLE_NAME,
            this.getInsertableObject(),
            this.TTL
        );
    }

    /**
     * Returns this object in it's database representation. Generally this means
     * returning the object with its keys in snake case and/or returning a
     * subset of fields
     */
    protected abstract getInsertableObject(): object;
}

export { SavableBase };
