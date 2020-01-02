# cqlmigrate

A tool for performing CQL migrations.

## Environment Variables

The following cqlmigrate environment variables should be set

`CQLMIGRATE_CASSANDRA_CONTACT_POINTS` - A space separated list of contact points for the Cassandra cluster

`CQLMIGRATE_ROOT_MIGRATION_DIRECTORY` - The `{root}` directory path for your migrations. See below for the required
directory layout (default = "/schema")

`CQLMIGRATE_INIT_FILENAME` - The `{initFile}` to search for in the `{root}` directory (default = "cqlmigrate.cql")

`CQLMIGRATE_KEYSPACE_BOOTSTRAP_FILENAME`- The `{bootstrapFile}` to search for in each `{keyspace}` directory. See
below for the required directory layout (default = "bootstrap.cql")

You may also optionally set

`CQLMIGRATE_MIGRATION_CLIENT_TIMEOUT_MS` - Timeout in milliseconds for applying a migration file (default = "30000")

`CQLMIGRATE_DEBUG` - Enables/disables debug logging (default = "false")

## Directory Layout

This tool assumes your cql files are laid out in the specific directory structure shown below. This tool was designed
with microservices in mind, where each service owns its own tables. You will find the directory structure has that in
mind, but the tool should still function just fine for other system architectures.

Note that the directory names do not change the tool's behavior at all. For example, you could technically make changes
to keyspace `A` from migrations within a keyspace `B` folder. However, doing so would not be recommended as migrations
are only guaranteed to run in order within their own service directory, and migrations from different service
directories may run in parallel

`{root}` - The root migration directory

`{initFile}` - The init file. This file sets up the cqlmigrate keyspace and tables required by cqlmigrate. The file
already exists (`cqlmigrate.cql` in the root directory of this project), and should be copied into your root migration
directory as is. This file can be modified in order to change replication strategies and factors.

`{keyspace}` - A keyspace folder. There may be any number of these within the `{root}` directory. Each `{keyspace}`
directory should have a file called `{bootstrapFile}`.

`{bootstrapFile}` - The filename to search for in `{keyspace}` directory. These bootstrap files are applied before any
migrations and should be used to set up the keyspace.

`{service}` - A service directory. There should be one of these for each service that has tables. The `{migration}`
files go inside the service directory for whichever service owns the table the migration is for.

`{migration}` - A migration file. Any number of these can exist in each `{service}` directory. These files must be
named such that when sorted lexically they will be in the order that they should be applied in.

```
{root}/
├── {initFile}
└── {keyspace}/
    ├── {bootstrapFile}
    └── {service}/
        └── {migration}.cql
```

As an example:

```
keyspaces/
├── cqlmigrate.cql
├── foo/
│   ├── bootstrap.cql
│   ├── serviceOne/
│   │   ├── 0001-initial.cql
│   │   └── 0002-someMigration.cql
│   └── serviceTwo/
│       └── 0001-initial.cql
└── bar/
    ├── bootstrap.cql
    └── serviceTwo/
        ├── 0001-initial.cql
        └── 0002-someMigration.cql
```

## Usage

### Install from npm

With npm

```sh
npm install -g @carnegietech/cqlmigrate
```

or with yarn

```sh
yarn global add @carnegietech/cqlmigrate
```

After installing, cqlmigrate can be run with

```sh
cqlmigrate
```

### Compile it yourself

Clone the repo and run

```sh
yarn install
yarn compile
```

After compiling, cqlmigrate can be run with

```sh
node build/app.js
```

## How it works

The tool will first attempt to acquire a lock for migrations. If this fails, we assume someone else is modifying
schemas and exit.

Next, it will load all of the bootstraps and migrations it finds in the directory structure laid out above.

The tool then starts applying migrations in "rounds". During each round of migrations, the tool finds the next
migration (sorted lexically) for each service, and applies that migration for each service in parallel. As an example,
if your migrations were all prefixed with numbers such as `0001`, `0002`, `0003`, etc., then the `0001` files from
every service directory will be applied in parallel. Once each round of migrations has been applied (such as all `0001`
files), the tool waits for all nodes to report in with the same schema. It will then move on to the next round using the
next available migration for each service.

If the tool finds that a migration has already been applied then it will skip it. If it finds a migration that failed
previously, it will exit with an error. If applying a migration fails, it will also exit with an error.

Any time the tool exits with an error, you will be able to find the migration that failed by checking the
`cqlmigrate.migrations` table. The failed migration, will have the `success` column set to `false`. Whenever possible,
the tool will try to provide meaningful logs about what went wrong.

After successfully applying all migrations, or after an error, the tool will attempt to release the lock. If for some
reason the tool is not able to release the lock, it will need to be manually removed from the `cqlmigrate.locks`
table.

## Example

An example set of migrations including the init file, keyspace bootstrap files, and service migrations can be found in
the `example` directory. Assuming a Cassandra node is available at `localhost:9042`, the example can be run with

```
CQLMIGRATE_CASSANDRA_CONTACT_POINTS="localhost:9042" \
CQLMIGRATE_ROOT_MIGRATION_DIRECTORY=./example \
    node build/app.js
```

## Tests

Tests can be run with

```
yarn test
```

## Docker Image

A base Dockerfile is provided in the root of this repository. The image can be built with `yarn docker:build`, which
build an image with the tag `cqmigrate:latest`. If you want to use a different tag then you can use the package prebuild
script and then run docker build manually:

```sh
yarn docker:prebuild
docker build -t <YOUR TAG> build
```

The Dockerfile does not set any environment variables or provide migration mounts. Those configurations will need to be
set by modifying/extending the Dockerfile or through some other means such as Kubernetes.

## Error Cases

Unfortunately, there are a number of things that can go wrong during a migration, and some of them will require manual
intervention.

### The Lock Table

As mentioned in the Usage section, cqlmigrate will first acquire a lock by inserting a row into the `cqlmigrate.locks`
table. If a row already exists, then cqlmigrate will not be able to acquire a lock. If you try running the tool and it
fails saying that it couldn't acquire the lock, that could mean one of two things:

1. Another instance of the tool is already running. This is probably an issue in your deployment process.
2. The tool previously ran but was not able to shut down gracefully. This almost certainly means that the previous run
failed.

If you find yourself in bullet #2, then you should check the logs of your previous run to find out what went wrong.

The tool will always try to release the lock before shutting down, even in the case of a migration error.

### Schema Consistency

After performing any operations that change the schema, the tool will block until all nodes in the Cassandra cluster
agree on what the schema is. This means that if any nodes are down (temporarily or permanently), then the nodes will
never be in agreement until the down node is brought back up or removed from the cluster. If the tool gets stuck on
the "waiting for schema agreement" phase for a long time, you may have run in to this issue.

N.B. Scaling down using kubernetes will only set the removed node as "down", and does not remove it from the cluster.
To remove a node from the cluster, you need to use `nodetool`.

### Mismatched Checksums

When cqlmigrate applies a migration, it stores a checksum of the canonical file that was applied. On all future runs,
it will make sure that all applied migration files still have the same checksum. If it finds any that don't match, it
will log an error stating which file didn't match, and then exit.

Note that since the checksum is calculated after canonicalizing, you can still make some minimal changes to migration
files. The canonicalization process removes excess whitespace, linebreaks, and comments. This means that you should be
to safely change any of those things and still get the same checksum. Keep in mind that we don't change the case of any
keywords or identifiers, so while they are generally case insensitive, changing them will cause the file to hash
differently.

### Other Errors

There are other non-specific places an error could come from. Primarily these would be errors reading from or writing to
Cassandra. When these errors occur and can't be handle by the tool, it will log the best message it can (usually just
the error message that was thrown) and then exit.

### Recovery

When these errors happen during a migration, the failed migration(s) will show `success` = `False` in the
`cqlmigrate.migrations` table. If you run the tool again with any failed migrations in the `migrations` table, it
will print an error and exit. This means you'll need to manually recover by the following steps

1. Make sure cqlmigrate is no longer running. There is a slim chance you will need to clear `cqlmigrate.locks`, if
cqlmigrate gets killed for some reason at a time when it has a lock
2. Delete the failed migration(s) from `cqlmigrate.migrations`
3. If any of the failed migration(s) did run, you will have to revert any changes it made (i.e. drop any tables it
created).
4. Fix the failed migration files
5. Run cqlmigrate again

There is another case that could happen besides a bad migration, which is a migration being renamed and modified. In
this case, the steps are a bit different:

1. Make sure cqlmigrate is no longer running. There is a slim chance you will need to clear `cqlmigrate.locks`, if
cqlmigrate gets killed for some reason at a time when it has a lock
2. Delete the `cqlmigrate.migrations` row related to the original filename
3. Delete the `cqlmigrate.migrations` row related to the new filename
4. Revert any changes made by either of the files (i.e. drop any tables created)
5. Run cqlmigrate again

If you know that a file has been renamed and modified before running cqlmigrate, you can skip step 2, and the half of
step 3 related to the new file.
