import { IGNORED_FIELDS } from '@/src/utils/migration';
import type { Model } from '@ronin/compiler';
import { Transaction } from '@ronin/compiler';
import type { Database } from '@ronin/engine';

interface Record {
  // biome-ignore lint/suspicious/noExplicitAny: These will be inferred shortly.
  indexes?: { [key: string]: any };
  // biome-ignore lint/suspicious/noExplicitAny: These will be inferred shortly.
  triggers?: { [key: string]: any };
  // biome-ignore lint/suspicious/noExplicitAny: These will be inferred shortly.
  fields?: { [key: string]: any };
  // biome-ignore lint/suspicious/noExplicitAny: These will be inferred shortly.
  presets?: { [key: string]: any };
  // biome-ignore lint/suspicious/noExplicitAny: These will be inferred shortly.
  [key: string]: any;
}

/**
 * Formats a database record into a Model by transforming nested objects into arrays with slugs
 */
const formatRecord = (record: Record): Model => ({
  ...record,
  slug: record.slug,
  indexes: Object.entries(record.indexes || {}).map(([slug, value]) => ({
    slug,
    ...JSON.parse(JSON.stringify(value)),
  })),
  presets: Object.entries(record.presets || {}).map(([slug, preset]) => ({
    ...preset,
    slug,
  })),
  triggers: Object.entries(record.triggers || {}).map(([slug, value]) => ({
    slug,
    ...JSON.parse(value),
  })),
  fields: Object.entries(record.fields || {})
    .filter(([slug]) => !IGNORED_FIELDS.includes(slug))
    .map(([slug, value]) => ({
      ...(typeof value === 'string' ? JSON.parse(value) : value),
      slug,
    })),
});

/**
 * Fetches and formats schema models from either production API or local database.
 *
 * @param db - The database instance to query from
 * @param token - Optional authentication token for production API requests
 * @param spaceId - Optional space ID for production API requests
 * @param isProduction - Optional flag to determine if production API should be used
 *
 * @returns Promise resolving to an array of formatted Model objects
 *
 * @throws Error if production API request fails
 */
export const getModels = async (
  db: Database,
  token?: string,
  spaceId?: string,
  isProduction?: boolean,
): Promise<Array<Model>> => {
  const transaction = new Transaction([{ get: { models: null } }]);
  const statements = transaction.statements.map((s) => s.statement);

  if (!isProduction) {
    const rawResult = await db.query(statements);
    const result = transaction.formatResults(
      rawResult.map((r) => r.rows),
      false,
    );
    // biome-ignore lint/suspicious/noExplicitAny: These will be inferred shortly.
    const records = (result[0] as any).records as Array<Record>;
    const formatted = records.map(formatRecord);

    return formatted;
  }

  try {
    const response = await fetch(`https://data.ronin.co/?data-selector=${spaceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nativeQueries: statements.map((query) => ({ query })),
      }),
    });

    const { results } = (await response.json()) as {
      results: Array<{ records: Array<Record> }>;
    };

    return results[0].records.map(formatRecord);
  } catch (error) {
    throw new Error(`Failed to fetch remote models: ${(error as Error).message}`);
  }
};
