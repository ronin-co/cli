import fs from 'node:fs';
import type { LocalPackages } from '@/src/utils/misc';
import { type Database, Engine } from '@ronin/engine';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';

/**
 * Initializes a new database instance.
 *
 * @param packages - A list of locally available RONIN packages.
 * @param fsPath - The file system path at which the database should be stored.
 *
 * @returns A new database instance.
 */
export const initializeDatabase = async (
  packages: LocalPackages,
  fsPath = '.ronin/db.sqlite',
): Promise<Database> => {
  const { Transaction, ROOT_MODEL } = packages.compiler;

  const engine = new Engine({
    resolvers: [(engine) => new MemoryResolver(engine)],
  });

  const transaction = new Transaction([
    {
      create: { model: ROOT_MODEL },
    },
  ]);

  const db = await engine.createDatabase({ id: 'local' });

  if (fs.existsSync(fsPath)) {
    const file = fs.readFileSync(fsPath);
    const buffer = new Uint8Array(file);
    await db.replaceContents(buffer);
  }

  try {
    await db.query(transaction.statements.map((statement) => statement.statement));
  } catch (_error) {
    // RONIN_SCHEMA already exists
  }

  return db;
};
