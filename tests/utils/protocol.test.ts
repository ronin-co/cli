import { describe, expect, test } from 'bun:test';
import fs, { type PathOrFileDescriptor } from 'node:fs';
import { getLocalPackages } from '@/src/utils/misc';
import { Protocol } from '@/src/utils/protocol';
import type { Model, Statement } from '@ronin/compiler';

describe('protocol', () => {
  test('should initialize with empty queries when none are provided', async () => {
    const packages = await getLocalPackages();

    const protocol = new Protocol(packages);
    expect(protocol.queries).toEqual([]);
  });

  test('should initialize with provided queries', async () => {
    const packages = await getLocalPackages();

    const queries = ["create.model({slug: 'model', pluralSlug: 'models'})"];
    const protocol = new Protocol(packages, queries);
    expect(protocol.queries).toEqual([]);
    expect(protocol.roninQueries).toEqual(queries);
  });

  test('save method should write migration file to disk', async () => {
    const packages = await getLocalPackages();

    const queries = ["create.model.to({slug: 'my_model', pluralSlug: 'my_models'})"];
    const protocol = new Protocol(packages, queries);
    const fileName = 'migration_test';

    // Mock `fs.writeFileSync`
    const originalWriteFileSync = fs.writeFileSync;
    let writeFileSyncCalled = false;

    fs.writeFileSync = (
      path: PathOrFileDescriptor,
      data: string | NodeJS.ArrayBufferView,
    ): void => {
      writeFileSyncCalled = true;
      expect(path).toBe(`${process.cwd()}/schema/migrations/${fileName}.ts`);
      expect(data).toContain(
        'create.model.to({ slug: "my_model", pluralSlug: "my_models" })',
      );
    };

    protocol.save(fileName);
    expect(writeFileSyncCalled).toBe(true);

    // Restore `fs.writeFileSync`
    fs.writeFileSync = originalWriteFileSync;
  });

  test('saveSQL method should write SQL statements to disk', async () => {
    const packages = await getLocalPackages();

    const queries = ["create.model({slug: 'my_model', pluralSlug: 'my_models'})"];
    const protocol = new Protocol(packages, queries);
    const fileName = 'migration_sql_test';
    const models: Array<Model> = [];

    // Mock `getSQLStatements`
    const originalGetSQLStatements = protocol.getSQLStatements;
    protocol.getSQLStatements = (): Array<Statement> => [
      {
        statement: 'CREATE SCHEMA my_schema;',
        params: [],
      },
    ];

    // Mock `fs.writeFileSync`
    const originalWriteFileSync = fs.writeFileSync;
    let writeFileSyncCalled = false;

    fs.writeFileSync = (
      path: PathOrFileDescriptor,
      data: string | ArrayBufferView,
    ): void => {
      writeFileSyncCalled = true;
      expect(path).toBe(`${process.cwd()}/schema/migrations/${fileName}.sql`);
      expect(data).toBe('CREATE SCHEMA my_schema;');
    };

    await protocol.saveSQL(fileName, models);
    expect(writeFileSyncCalled).toBe(true);

    // Restore mocks
    fs.writeFileSync = originalWriteFileSync;
    protocol.getSQLStatements = originalGetSQLStatements;
  });

  test('get SQL statements', async () => {
    const packages = await getLocalPackages();

    const queries: Array<string> = ["get.account.with({handle: 'elaine'});"];

    const models: Array<Model> = [
      {
        slug: 'account',
        fields: [
          {
            slug: 'handle',
            type: 'string',
          },
        ],
      },
    ];
    const protocol = await new Protocol(packages, queries).convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);

    expect(statements).toHaveLength(1);
    expect(statements[0].statement).toStrictEqual(
      `SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "accounts" WHERE "handle" = 'elaine' LIMIT 1`,
    );
  });

  test('load specific migration file', async () => {
    const packages = await getLocalPackages();

    // Path to this file is `./tests/fixtures/protocol.ts`
    const fileName = `${process.cwd()}/tests/fixtures/protocol.ts`;

    const protocol = new Protocol(packages);
    await protocol.load(fileName);
    expect(protocol.queries).toHaveLength(1);
    expect(JSON.stringify(protocol.queries[0])).toStrictEqual(
      JSON.stringify({
        get: {
          account: {
            with: {
              handle: 'elaine',
            },
          },
        },
      }),
    );
  });

  test('load latest migration file', async () => {
    const packages = await getLocalPackages();

    const protocol = new Protocol(packages);
    try {
      await protocol.load();
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('Migration protocol file');
    }
  });
});
