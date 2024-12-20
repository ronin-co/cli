import { Transaction } from '@ronin/compiler';

import fs from 'node:fs';
import type { Model } from '@ronin/compiler';
import { type Database, Engine } from '@ronin/engine';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';

const engine = new Engine({
  resolvers: [(engine) => new MemoryResolver(engine)],
});

/**
 * Queries a test database with the provided SQL statements.
 *
 * @param models - The models that should be inserted into the database.
 * @param statements - The statements that should be executed.
 *
 * @returns A list of rows resulting from the executed statements.
 */
export const queryEphemeralDatabase = async (models: Array<Model>): Promise<Database> => {
  const databaseName = Math.random().toString(36).substring(7);
  const db = await engine.createDatabase({ id: databaseName });

  const DB_LOCATION = './tests/fixtures/minimal.db';

  const file = fs.readFileSync(DB_LOCATION);
  const buffer = new Uint8Array(file);
  await db.replaceContents(buffer);

  await prefillDatabase(db, models);

  return db;
};

/**
 * Prefills the database with the provided models.
 *
 * @param databaseName - The name of the database to prefill.
 * @param models - The models that should be inserted into the database.
 */
export const prefillDatabase = async (db: Database, models: Array<Model>): Promise<void> => {
  const queries = models.map((model) => {
    return {
      create: {
        model: model,
      },
    };
  });

  const transaction = new Transaction(queries);
  await db.query(transaction.statements);
};
