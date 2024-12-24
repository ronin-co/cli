import fs from 'node:fs';
import { ROOT_MODEL, Transaction } from '@ronin/compiler';
import { type Database, Engine } from '@ronin/engine';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';

export const initializeDatabase = async (
  fsPath = '.ronin/db.sqlite',
): Promise<Database> => {
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
