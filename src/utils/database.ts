import fs from 'node:fs';
import { ROOT_MODEL, Transaction } from '@ronin/compiler';
import { Engine } from '@ronin/engine';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';

const engine = new Engine({
  resolvers: [(engine) => new MemoryResolver(engine)],
});

const transaction = new Transaction([
  {
    create: { model: ROOT_MODEL },
  },
]);

export const db = await engine.createDatabase({ id: 'local' });

let DB_LOCATION = '.ronin/db.sqlite';

if (process.env.NODE_ENV === 'test') {
  DB_LOCATION = './tests/fixtures/minimal.db';
}

if (fs.existsSync(DB_LOCATION)) {
  const file = fs.readFileSync(DB_LOCATION);
  const buffer = new Uint8Array(file);
  await db.replaceContents(buffer);
}

try {
  await db.query(transaction.statements.map((statement) => statement.statement));
} catch (_error) {
  console.log('ronin_schema already exists');
}
