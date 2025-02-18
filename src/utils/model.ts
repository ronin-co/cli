import { IGNORED_FIELDS } from '@/src/utils/migration';
import {
  type LocalPackages,
  type QueryResponse,
  getResponseBody,
} from '@/src/utils/misc';
import type { Model } from '@ronin/compiler';
import type { Database } from '@ronin/engine';
import type { Row } from '@ronin/engine/types';

/**
 * Fetches and formats schema models from either production API or local database.
 *
 * @param packages - A list of locally available RONIN packages.
 * @param db - The database instance to query from.
 * @param token - Optional authentication token for production API requests.
 * @param space - Optional space ID for production API requests.
 * @param isLocal - Optional flag to determine if production API should be used.
 *
 * @returns Promise resolving to an array of formatted Model objects.
 *
 * @throws Error if production API request fails.
 */
export const getModels = async (
  packages: LocalPackages,
  db: Database,
  token?: string,
  space?: string,
  isLocal = true,
): Promise<Array<Model>> => {
  const { Transaction } = packages.compiler;
  const transaction = new Transaction([{ get: { models: null } }]);

  let rawResults: Array<Array<Row>>;

  if (isLocal) {
    rawResults = (await db.query(transaction.statements)).map((r) => r.rows);
  } else {
    try {
      const nativeQueries = transaction.statements.map((statement) => ({
        query: statement.statement,
        values: statement.params,
      }));

      const response = await fetch(`https://data.ronin.co/?data-selector=${space}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nativeQueries }),
      });

      const responseResults = await getResponseBody<QueryResponse<Model>>(response);

      rawResults = responseResults.results.map((result) => {
        return 'records' in result ? result.records : [];
      });
    } catch (error) {
      throw new Error(`Failed to fetch remote models: ${(error as Error).message}`);
    }
  }

  const results = transaction.formatResults<Model>(rawResults, false);
  const models = 'records' in results[0] ? results[0].records : [];

  const test = {
    name: {
      type: 'string',
    },
    yeet: {
      type: 'string',
      yeet: 'broke',
    },
  };

  return models.map((model) => ({
    ...model,
    fields: convertObjectToArray(model.fields)?.filter(
      (field) => !IGNORED_FIELDS.includes(field.slug),
    ),
  }));
};

export const convertObjectToArray = (input: any): any[] => {
  return Object.entries(input).map(([key, value]) => ({ slug: key, ...value }));
};

export const convertArrayToObject = (fields: any[] | undefined) => {
  if (!fields) return {};

  return fields.reduce((obj, field) => {
    const { slug, ...rest } = field;
    obj[slug] = rest;
    return obj;
  }, {});
};

export const convertModelToArrayFields = (model: Model): any => {
  return { ...model, fields: convertObjectToArray(model.fields) };
};

export const convertModelToObjectFields = (model: Model): any => {
  return { ...model, fields: convertArrayToObject(model.fields) };
};
