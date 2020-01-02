/* Keyspace and tables for the cqlmigrate tool */

/* Create the cqlmigrate keyspace */
CREATE KEYSPACE IF NOT EXISTS cqlmigrate WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1 };

/* Lock table for cqlmigrate */
CREATE TABLE IF NOT EXISTS cqlmigrate.locks (
    name text, /* The name of the lock */
    client uuid, /* A uuid identifying the client which has the lock */

    PRIMARY KEY ((name))
);

/* All migrations that have been applied or attempted to be applied */
CREATE TABLE IF NOT EXISTS cqlmigrate.migrations(
    keyspace_name text, /* The keyspace the migration is in */
    service text, /* The service the migration is for */
    file text, /* The filename of the migration */

    applied_on timestamp, /* The timestamp of when the migration was applied */
    checksum text, /* md5 hash (in hex) of the migration body */
    success boolean, /* Whether or not the migration succeeded */
    body text, /* The minified body of the migration file */

    PRIMARY KEY ((keyspace_name), service, file)
);

/* All bootstraps that have been applied or attempted to be applied */
CREATE TABLE IF NOT EXISTS cqlmigrate.bootstraps(
    keyspace_name text, /* The keyspace the bootstrap is for */
    applied_on timestamp, /* The date the bootstrap was applied on */

    file text, /* The filename of the bootstrap */
    success boolean, /* Whether or not the bootstrap succeeded */
    body text, /* The minified body of the bootstrap file */

    PRIMARY KEY ((keyspace_name), applied_on)
);
