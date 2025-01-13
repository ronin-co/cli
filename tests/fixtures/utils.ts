import { ROOT_MODEL, Transaction } from '@ronin/compiler';

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
  const databaseId = Math.random().toString(36).substring(7);
  const database = await engine.createDatabase({ id: databaseId });

  await prefillDatabase(database, models);

  return database;
};

/**
 * Prefills the database with the provided models.
 *
 * @param databaseName - The name of the database to prefill.
 * @param models - The models that should be inserted into the database.
 */
export const prefillDatabase = async (
  db: Database,
  models: Array<Model>,
): Promise<void> => {
  const rootModelTransaction = new Transaction([{ create: { model: ROOT_MODEL } }]);

  const modelTransaction = new Transaction(
    models.map((model) => ({ create: { model } })),
  );

  await db.query([...rootModelTransaction.statements, ...modelTransaction.statements]);
};
