import fs from 'node:fs';
import { getPackage } from '@/src/utils/misc';
import { type Database, Engine } from '@ronin/engine';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';

export const initializeDatabase = async (
  fsPath = '.ronin/db.sqlite',
): Promise<Database> => {
  const { Transaction, ROOT_MODEL } = await getPackage('compiler');

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
