import logIn from '@/src/commands/login';
import { IGNORED_FIELDS } from '@/src/utils/migration';
import {
  InvalidResponseError,
  type LocalPackages,
  type QueryResponse,
  getResponseBody,
} from '@/src/utils/misc';
import { spinner } from '@/src/utils/spinner';
import type { Model } from '@ronin/compiler';
import type { Database, Row } from '@ronin/engine/resources';

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
  db?: Database,
  token?: string,
  space?: string,
  isLocal = true,
): Promise<Array<Model>> => {
  const { Transaction } = packages.compiler;
  const transaction = new Transaction([{ get: { models: null } }]);

  let rawResults: Array<Array<Row>>;

  if (isLocal && db) {
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
      // If the session is no longer valid, log in again and try to fetch the models again.
      if (
        error instanceof InvalidResponseError &&
        error.code &&
        error.code === 'AUTH_INVALID_SESSION'
      ) {
        spinner.stop();
        const sessionToken = await logIn(undefined, false);
        spinner.start();
        return getModels(packages, db, sessionToken, space, isLocal);
      }

      throw new Error(`Failed to fetch remote models: ${(error as Error).message}`);
    }
  }

  const results = transaction.formatResults<Model>(rawResults, false);
  const models = 'records' in results[0] ? results[0].records : [];

  // @ts-expect-error This will work once the types are fixed.
  return models.map((model) => ({
    ...model,
    // @ts-expect-error This will work once the types are fixed.
    fields: convertObjectToArray(model.fields)?.filter(
      (field) => !IGNORED_FIELDS.includes(field.slug),
    ),
  }));
};

/**
 * Converts an object of fields into an array of field objects with slugs.
 *
 * @param input - Object containing field definitions.
 *
 * @returns Array of field objects with slugs.
 */
export const convertObjectToArray = <T extends Record<string, unknown>>(
  input: T,
): Array<{ slug: string } & T[keyof T]> => {
  return Object.entries(input).map(([key, value]) => ({
    slug: key,
    // @ts-expect-error This will work once the types are fixed.
    ...(value as T[keyof T]),
  }));
};

/**
 * Converts an array of field objects with slugs into an object keyed by slug.
 *
 * @param fields - Array of field objects with slugs.
 *
 * @returns Object with fields keyed by slug.
 */
export const convertArrayToObject = <T extends { slug: string }>(
  fields: Array<T> | undefined,
): Record<string, Omit<T, 'slug'>> => {
  if (!fields) return {};

  return fields.reduce<Record<string, Omit<T, 'slug'>>>((obj, field) => {
    const { slug, ...rest } = field;
    obj[slug] = rest;
    return obj;
  }, {});
};

/**
 * Converts a model's fields from object format to array format.
 *
 * @param model - Model with fields in object format.
 *
 * @returns Model with fields converted to array format.
 */
export const convertModelToArrayFields = (model: Model): Model => {
  // @ts-expect-error This will work once the types are fixed.
  if (JSON.stringify(model) === '{}') return {};
  // @ts-expect-error This will work once the types are fixed.
  return { ...model, fields: convertObjectToArray(model.fields) };
};

/**
 * Converts a model's fields from array format to object format.
 *
 * @param model - Model with fields in array format.
 *
 * @returns Model with fields converted to object format.
 */
export const convertModelToObjectFields = (model: Model): Model => {
  // @ts-expect-error This will work once the types are fixed.
  return { ...model, fields: convertArrayToObject(model.fields) };
};
