import { describe, expect, test } from 'bun:test';
import fs, { type PathOrFileDescriptor } from 'node:fs';
import { Protocol } from '@/src/utils/protocol';
import type { Model, Statement } from '@ronin/compiler';

describe('protocol', () => {
  test('should initialize with empty queries when none are provided', () => {
    const protocol = new Protocol();
    expect(protocol.queries).toEqual([]);
  });

  test('should initialize with provided queries', () => {
    const queries = ["create.model({slug: 'model', pluralSlug: 'models'})"];
    const protocol = new Protocol(queries);
    expect(protocol.queries).toEqual([]);
    expect(protocol.roninQueries).toEqual(queries);
  });

  test('save method should write migration file to disk', () => {
    const queries = ["create.model.to({slug: 'my_model', pluralSlug: 'my_models'})"];
    const protocol = new Protocol(queries);
    const fileName = 'migration_test';

    // Mock fs.writeFileSync
    const originalWriteFileSync = fs.writeFileSync;
    let writeFileSyncCalled = false;

    fs.writeFileSync = (
      path: PathOrFileDescriptor,
      data: string | NodeJS.ArrayBufferView,
    ) => {
      writeFileSyncCalled = true;
      expect(path).toBe(`${process.cwd()}/models/.protocols/${fileName}.ts`);
      expect(data).toContain(queries[0]);
    };

    protocol.save(fileName);
    expect(writeFileSyncCalled).toBe(true);

    // Restore fs.writeFileSync
    fs.writeFileSync = originalWriteFileSync;
  });

  test('saveSQL method should write SQL statements to disk', async () => {
    const queries = ["create.model({slug: 'my_model', pluralSlug: 'my_models'})"];
    const protocol = new Protocol(queries);
    const fileName = 'migration_sql_test';
    const models: Array<Model> = [];

    // Mock getSQLStatements
    const originalGetSQLStatements = protocol.getSQLStatements;
    protocol.getSQLStatements = () =>
      [
        {
          statement: 'CREATE SCHEMA my_schema;',
          params: [],
        },
      ] as Array<Statement>;

    // Mock fs.writeFileSync
    const originalWriteFileSync = fs.writeFileSync;
    let writeFileSyncCalled = false;

    fs.writeFileSync = (path: PathOrFileDescriptor, data: string | ArrayBufferView) => {
      writeFileSyncCalled = true;
      expect(path).toBe(`${process.cwd()}/models/.protocols/${fileName}.sql`);
      expect(data).toBe('CREATE SCHEMA my_schema;');
    };

    await protocol.saveSQL(fileName, models);
    expect(writeFileSyncCalled).toBe(true);

    // Restore mocks
    fs.writeFileSync = originalWriteFileSync;
    protocol.getSQLStatements = originalGetSQLStatements;
  });

  test('get SQL statements', async () => {
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
    const protocol = await new Protocol(queries).convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);

    expect(statements).toHaveLength(1);
    expect(statements[0].statement).toStrictEqual(
      'SELECT * FROM "accounts" WHERE ("handle" = \'elaine\') LIMIT 1',
    );
  });

  test('load specific migration file', async () => {
    // path to this file is ./tests/fixtures/protocol.ts
    const fileName = `${process.cwd()}/tests/fixtures/protocol.ts`;

    const protocol = new Protocol();
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
    const protocol = new Protocol();
    try {
      await protocol.load();
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('Migration protocol file');
    }
  });
});
