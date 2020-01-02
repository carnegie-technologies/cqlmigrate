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
 * Functions for acquiring and releasing the migration lock
 */

import { types } from 'cassandra-driver';

import { CassandraClient } from '../lib/CassandraClient';
import * as logger from '../lib/Logger';

const keyspace: string = 'cqlmigrate';
const table: string = 'locks';

const name: string = 'MIGRATION_LOCK';
const client: string = types.Uuid.random().toString();

const TTL: number = 0;

/**
 * Acquires the migration lock using a LWT
 */
export async function acquire(): Promise<boolean> {
    logger.info({ message: 'Attempting to acquire lock', client });

    try {
        const result: types.ResultSet = await CassandraClient.GET_INSTANCE(keyspace).insert(
            table, { name, client }, TTL, true, { consistency: types.consistencies.all }
        );

        return result.wasApplied();
    }
    catch (e) {
        return false;
    }
}

/**
 * Releases the migration lock using a LWT
 */
export async function release(): Promise<boolean> {
    logger.info({ message: 'Attempting to release lock', client });

    try {
        const result: types.ResultSet = await CassandraClient.GET_INSTANCE(keyspace).execute(
            `DELETE FROM ${table} WHERE name = ? IF client = ?`,
            [name, client],
            { consistency: types.consistencies.all }
        );

        return result.wasApplied();
    }
    catch (e) {
        return false;
    }
}
