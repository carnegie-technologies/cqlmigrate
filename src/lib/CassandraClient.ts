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
 * Wrapper around cassandra-driver to provide a more usable interface
 */

import { Client, Host, policies, QueryOptions, types } from 'cassandra-driver';

import { config } from '../config';
import * as logger from './Logger';
import { StorableDate, STORAGE_METHOD } from './StorableDate';

/**
 * A set of arrays created by CassandraClient.createQueryArrays(). These are
 * arrays that are useful for building query strings. All of the arrays are of
 * equal length and can be used in combination with each other when needed to
 * create query strings. They should not be modified.
 */
interface QueryArrays {
    // The field/property names from the object these arrays were created from
    fields: string[];

    // Every value in this array is "?". This can be used to fill in
    // placeholders for any params in a query.
    placeholders: string[];

    // For each field, f, there is an entry in this array of the form '"f" = ?'
    fieldsEqualPlaceholders: string[];

    // The values associated with each entry in fields
    // Need to use type any as any storable value could be stored in the array
    // tslint:disable-next-line no-any
    params: any[];
}

/**
 * A row containing the schema_version field
 */
interface SchemaVersionRow {
    schema_version?: types.Uuid;
}

/**
 * A row from the system.peers table
 */
interface PeerRow extends SchemaVersionRow {
    peer?: types.InetAddress;
    data_center?: string;
    host_id?: types.Uuid;
    preferred_ip?: types.InetAddress;
    rack?: string;
    release_version?: string;
    rpc_address?: types.InetAddress;
    tokens?: string[];
}

/**
 * Wrapper around cassandra-driver to provide a Cassandra client with a more
 * user friendly interface
 */
export class CassandraClient {
    /**
     * The mapping of singleton instances of the Cassandra Client object. There is one instance stored per keyspace
     */
    private static instances: Map<string, CassandraClient> = new Map();

    protected readonly client: Client;

    /**
     * The constructor configures the Cassandra driver connection, load balancing policy and keyspace
     *
     * @param keyspace  the keyspace to connect the driver to
     * @param contactPoints  the cassandra contact points for connecting to the cluster
     */
    public constructor(keyspace: string, contactPoints: string[]) {
        this.client = new Client({
            contactPoints,
            policies: {
                loadBalancing: new policies.loadBalancing.DCAwareRoundRobinPolicy()
            },
            keyspace
        });
    }

    /**
     * Gets an instance of the Cassandra data store, where each new keyspace gets it's own instance of the Cassandra
     * data store. This is so that the same client can be reused for every request that is in the same keyspace.
     * Requests for instances with the same keyspace will return the same instance (like a singleton).
     *
     * @param keyspace  the keyspace of the Cassandra data store to retrieve
     */
    public static GET_INSTANCE(
        keyspace: string,
        contactPoints: string[] = config.get('cassandraContactPoints').split(' ')
    ): CassandraClient {
        if (!this.instances.has(keyspace)) {
            this.instances.set(keyspace, new CassandraClient(
                keyspace,
                contactPoints
            ));
        }

        return this.instances.get(keyspace);
    }

    /**
     * Executes a query against Cassandra
     */
    public async execute(
        query: string,
        params: any[] = [], // tslint:disable-line no-any
        options: QueryOptions = {}
    ): Promise<types.ResultSet> {
        logger.debug({ message: 'Execute', query, params });

        if (options.prepare == null) {
            options.prepare = true;
        }

        try {
            const results: types.ResultSet = await this.client.execute(
                query,
                params,
                options
            );
            logger.debug({
                message: 'Query Complete',
                query,
                params,
                resultInfo: JSON.stringify(results.info),
                resultCount: results.rowLength
            });

            return results;
        } catch (error) {
            logger.info({ message: 'Query Error', query, params, error });
            throw error;
        }
    }

    /**
     * Inserts a new record into the data store by using the object keys as
     * column values and the object values as the values to be inserted. The
     * values themselves can be of any type except undefined and function.
     */
    public async insert(
        table: string,
        record: object,
        ttl?: number,
        ifNotExists: boolean = false,
        options?: QueryOptions
    ): Promise<types.ResultSet> {
        const queryArrays: QueryArrays = this.createQueryArrays(record);

        if (queryArrays.fields.length === 0) {
            throw new Error('Input object does not have any savable fields');
        } else {
            const ifNotExistsString: string = ifNotExists
                ? ' IF NOT EXISTS'
                : '';
            const ttlString: string = ttl == null ? '' : ' USING TTL ' + ttl;
            const query: string =
                `INSERT INTO ${table} (${queryArrays.fields.join(
                    ','
                )}) VALUES (${queryArrays.placeholders.join(',')})` +
                `${ifNotExistsString}${ttlString};`;
            return this.execute(query, queryArrays.params, options);
        }
    }

    /**
     * Checks if all nodes (the node contacted, and all of its peers) have the
     * same schema version. Note that nodes that are offline but still part of
     * the cluster will also be included in this check. That means that any
     * schema changes made with nodes offline will cause this to return false
     * until the node has come back online and caught back up.
     */
    public async checkSchemaAgreement(): Promise<boolean> {
        logger.debug({ message: 'Checking for schema agreement on all nodes' });

        const versions: Set<string> = new Set<string>();

        const localResult: types.ResultSet = await this.execute(
            'SELECT * FROM system.local'
        );
        const peerResult: types.ResultSet = await this.execute(
            'SELECT * FROM system.peers'
        );

        const localRow: SchemaVersionRow = localResult.first() as SchemaVersionRow;
        if (localRow == null || localRow.schema_version == null) {
            return false;
        }
        versions.add(localRow.schema_version.toString());

        for (const peer of peerResult.rows as PeerRow[]) {
            if (peer.peer != null && peer.rpc_address != null) {
                const peerHost: Host = this.client.hosts.get(
                    peer.rpc_address.toString()
                );
                if (peerHost == null || !peerHost.isUp()) {
                    logger.info({
                        message:
                            'Peer node is not up. Schemas can not be in agreement until it has been brought up ' +
                            'or removed with "nodetool remove"',
                        peer: peer.peer,
                        datacenter: peer.data_center,
                        rack: peer.rack
                    });
                }
            }
            versions.add(peer.schema_version.toString());
        }

        logger.debug({
            message: `Nodes report a total of ${versions.size} versions`,
            agreement: versions.size <= 1
        });

        return versions.size <= 1;
    }

    /**
     * Returns a promise that only resolves when checkSchemaAgreement returns
     * true.
     *
     * @param retryIntervalMs How often to wait between each check (default: 1000)
     */
    public async getSchemaAgreementPromise(
        retryIntervalMs: number = 1000
    ): Promise<void> {
        while (!(await this.checkSchemaAgreement())) {
            // We don't actually want to do anything here. We just want to keep
            // checking if the schemas are in agreement until it returns true.
            // Sleep for the provided duration just to make sure we aren't
            // sending too many queries.
            await new Promise((resolve): void => { setTimeout(resolve, retryIntervalMs); });
        }
    }

    /**
     * Builds helper arrays out of the provided object. These are just the
     * object represented in various forms that are useful for building query
     * strings.
     */
    private createQueryArrays(obj: object): QueryArrays {
        const arrays: QueryArrays = {
            fields: [],
            placeholders: [],
            fieldsEqualPlaceholders: [],
            params: []
        };

        Object.keys(obj).forEach(
            (key: string): void => {
                switch (typeof obj[key]) {
                    case 'number':
                    case 'string':
                    case 'boolean':
                        push(key, obj[key]);
                        break;

                    case 'object':
                        let value: object;
                        if (obj[key] instanceof StorableDate) {
                            const dateTime: StorableDate = obj[
                                key
                            ] as StorableDate;
                            switch (dateTime.getStorageMethod()) {
                                case STORAGE_METHOD.UUID:
                                    value = types.TimeUuid.fromDate(
                                        dateTime.getDate()
                                    );
                                    break;
                                case STORAGE_METHOD.DATE_ONLY:
                                    value = types.LocalDate.fromDate(
                                        dateTime.getDate()
                                    );
                                    break;
                                default:
                                    value = dateTime.getDate();
                            }
                        } else {
                            value = obj[key];
                        }
                        push(key, value);
                        break;

                    default:
                    // ignore functions and undefined
                }
            }
        );

        /**
         * Pushes the key and value into the appropriate arrays for query generation
         *
         * @param key   the key to insert into the query
         * @param value the value to insert into the query
         */
        // tslint:disable-next-line no-any
        function push(key: string, value: any): void {
            arrays.fields.push(`"${key}"`);
            arrays.fieldsEqualPlaceholders.push(`"${key}" = ?`);
            arrays.params.push(value);
            arrays.placeholders.push('?');
        }

        return arrays;
    }
}
