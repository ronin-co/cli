import { describe, expect, test } from 'bun:test';
import { initializeDatabase } from '@/src/utils/database';
import { getLocalPackages } from '@/src/utils/misc';

describe('database', () => {
  test('should initialize database', async () => {
    const packages = await getLocalPackages();

    const db = await initializeDatabase(packages, './tests/fixtures/minimal.db');
    const results = await db.query([
      "SELECT name FROM sqlite_master WHERE type='table';",
    ]);
    const rows = results[0].rows;

    expect(rows).toHaveLength(1);
    expect(db).toBeDefined();
  });
});
