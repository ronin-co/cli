import { describe, expect, test } from 'bun:test';

describe('database', () => {
  test('should initialize database', async () => {
    const { db } = await import('@/src/utils/database');
    const results = await db.query([
      "SELECT name FROM sqlite_master WHERE type='table';",
    ]);
    const rows = results[0].rows;

    expect(rows).toHaveLength(1);
    expect(db).toBeDefined();
  });
});
