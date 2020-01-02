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
 * @file Sets up the configuration
 */

// tslint:disable no-magic-numbers

import * as convict from 'convict';

export let config = convict({
    env: {
        doc: 'The environment to run in',
        format: 'String',
        default: 'production',
        env: 'NODE_ENV'
    },
    migrationDirectory: {
        doc: 'The root directory path for migrations e.g. {root} in {root}/{keyspace}/{service}/{migration}.cql',
        format: 'String',
        default: '/schema',
        env: 'CQLMIGRATE_ROOT_MIGRATION_DIRECTORY'
    },
    migrationClientTimeoutMs: {
        doc: 'The client side timeout to use when applying queries.',
        format: 'Number',
        default: 30 * 1000,
        env: 'CQLMIGRATE_MIGRATION_CLIENT_TIMEOUT_MS'
    },
    initFilename: {
        doc: 'The init filename to search for in the root directory. e.g. cqlmigrate.cql',
        format: 'String',
        default: 'cqlmigrate.cql',
        env: 'CQLMIGRATE_INIT_FILENAME'
    },
    bootstrapFilename: {
        doc: 'The bootstrap filename to search for in each keyspace directory. e.g. bootstrap.cql',
        format: 'String',
        default: 'bootstrap.cql',
        env: 'CQLMIGRATE_KEYSPACE_BOOTSTRAP_FILENAME'
    },
    cassandraContactPoints: {
        doc: 'The contact points for Cassandra',
        format: 'String',
        default: 'localhost',
        env: 'CQLMIGRATE_CASSANDRA_CONTACT_POINTS'
    },
    debug: {
        doc: 'Enables debug logs',
        format: 'Boolean',
        default: false,
        env: 'CQLMIGRATE_DEBUG'
    }
});

config.validate({ allowed: 'strict' });
