import { getLocalPackages } from '@/src/utils/misc';

import { diffModels } from '@/src/utils/migration';
import { getModels } from '@/src/utils/model';
import { Protocol } from '@/src/utils/protocol';
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
  const { Transaction, ROOT_MODEL } = (await getLocalPackages()).compiler;

  const rootModelTransaction = new Transaction([{ create: { model: ROOT_MODEL } }]);

  const modelTransaction = new Transaction(
    models.map((model) => ({ create: { model } })),
  );

  await db.query([...rootModelTransaction.statements, ...modelTransaction.statements]);
};

/**
 * Runs a migration by comparing defined models against existing models and applying the differences.
 *
 * @param definedModels - The new/updated model definitions to migrate to.
 * @param existingModels - The current models in the database.
 * @param enableRename - Whether to enable model renaming during migration (defaults to false).
 *
 * @returns Object containing:
 *   - db: The ephemeral database instance.
 *   - packages: The loaded package dependencies.
 *   - models: The resulting models after migration.
 *   - statements: The SQL statements that were executed.
 *   - modelDiff: The computed differences between defined and existing models.
 */
export async function runMigration(
  definedModels: Array<Model>,
  existingModels: Array<Model>,
  enableRename = false,
) {
  const db = await queryEphemeralDatabase(existingModels);
  const packages = await getLocalPackages();
  const models = await getModels(packages, db);

  const modelDiff = await diffModels(definedModels, models, enableRename);
  const protocol = new Protocol(packages, modelDiff);
  await protocol.convertToQueryObjects();

  const statements = protocol.getSQLStatements(models);
  await db.query(statements);

  return {
    db,
    packages,
    models: await getModels(packages, db),
    statements,
    modelDiff,
  };
}

/**
 * Retrieves a list of all table names from a SQLite database.
 *
 * @param db - The database instance to query.
 *
 * @returns A list of table names mapped from the query results.
 */
export async function getSQLTables(db: Database) {
  const res = await db.query(['SELECT name FROM sqlite_master WHERE type="table";']);
  return res[0].rows;
}
