import { RONIN_SCHEMA_TEMP_SUFFIX } from '@/src/utils/misc';
import type { Model, ModelField, ModelIndex, ModelTrigger } from '@ronin/compiler';

/**
 * Generates a RONIN query to drop a model.
 *
 * @param modelSlug - The identifier for the model.
 *
 * @returns A string representing the RONIN drop model query.
 *
 * @example
 * ```typescript
 * dropModelQuery('user') // Output: drop.model("user")
 * ```
 */
export const dropModelQuery = (modelSlug: string): string => {
  return `drop.model("${modelSlug}")`;
};

/**
 * Generates a RONIN query to create a model.
 *
 * @param modelSlug - The identifier for the model.
 * @param properties - Optional model properties like fields, pluralSlug, etc.
 *
 * @returns A string representing the RONIN create model query.
 *
 * @example
 * ```typescript
 * createModelQuery('user') // Output: create.model({slug:'user'})
 * createModelQuery('user', { pluralSlug: 'users' }) // Output: create.model({slug:'user',pluralSlug:'users'})
 * ```
 */
export const createModelQuery = (
  modelSlug: string,
  properties?: Partial<Model>,
): string => {
  if (properties) {
    const propertiesString = Object.entries(properties)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => {
        return `${key}:${serialize(value)}`;
      })
      .join(', ');
    return `create.model({slug:'${modelSlug}',${propertiesString}})`;
  }
  return `create.model({slug:'${modelSlug}'})`;
};

/**
 * Generates a RONIN query to create a field in a model.
 *
 * @param modelSlug - The identifier for the model.
 * @param field - The field configuration to create.
 *
 * @returns A string representing the RONIN create field query.
 *
 * @example
 * ```typescript
 * createFieldQuery('user', { slug: 'email', type: 'string', unique: true })
 * // Output: alter.model('user').create.field({"slug":"email","type":"string","unique":true})
 * ```
 */
export const createFieldQuery = (modelSlug: string, field: ModelField): string => {
  return `alter.model('${modelSlug}').create.field(${JSON.stringify(field)})`;
};

/**
 * Generates a RONIN query to modify a field in a model.
 *
 * @param modelSlug - The identifier for the model.
 * @param fieldSlug - The identifier for the field to modify.
 * @param fieldTo - The new field properties.
 *
 * @returns A string representing the RONIN set field query.
 *
 * @example
 * ```typescript
 * setFieldQuery('user', 'email', { unique: true })
 * // Output: alter.model("user").alter.field("email").to({"unique":true})
 * ```
 */
export const setFieldQuery = (
  modelSlug: string,
  fieldSlug: string,
  fieldTo: Partial<ModelField>,
): string => {
  return `alter.model("${modelSlug}").alter.field("${fieldSlug}").to(${JSON.stringify(fieldTo)})`;
};

/**
 * Generates a RONIN query to drop a field from a model.
 *
 * @param modelSlug - The identifier for the model.
 * @param fieldSlug - The identifier for the field to drop.
 *
 * @returns A string representing the RONIN drop field query.
 *
 * @example
 * ```typescript
 * dropFieldQuery('user', 'email') // Output: alter.model("user").drop.field("email")
 * ```
 */
export const dropFieldQuery = (modelSlug: string, fieldSlug: string): string => {
  return `alter.model("${modelSlug}").drop.field("${fieldSlug}")`;
};

/**
 * Generates RONIN queries to create a temporary model for field updates.
 *
 * @param modelSlug - The identifier for the model.
 * @param fields - The fields to include in the temporary model.
 * @param indexes - The indexes to include in the temporary model.
 * @param customQueries - Optional additional queries to execute.
 *
 * @returns An array of RONIN queries for the temporary model operations.
 *
 * @example
 * ```typescript
 * createTempModelQuery('user', [{slug: 'email', type: 'string'}])
 * // Output: [
 * //   'create.model({slug:"RONIN_TEMP_user",fields:[{slug:"email",type:"string"}]})',
 * //   'drop.model("user")',
 * //   'alter.model("RONIN_TEMP_user").to({slug: "user"})'
 * // ]
 * ```
 */
export const createTempModelQuery = (
  modelSlug: string,
  fields: Array<ModelField>,
  _indexes: Array<ModelIndex>,
  triggers: Array<ModelTrigger>,
  customQueries?: Array<string>,
): Array<string> => {
  const queries: Array<string> = [];

  const tempModelSlug = `${RONIN_SCHEMA_TEMP_SUFFIX}${modelSlug}`;

  // Create a copy of the model
  queries.push(createModelQuery(tempModelSlug, { fields }));

  // Move all the data to the copied model
  queries.push(`add.${tempModelSlug}.to(() => get.${modelSlug}())`);

  if (customQueries) {
    queries.push(...customQueries);
  }

  // Delete the original model
  queries.push(dropModelQuery(modelSlug));

  // Rename the copied model to the original model
  queries.push(`alter.model("${tempModelSlug}").to({slug: "${modelSlug}"})`);

  for (const trigger of triggers) {
    queries.push(createTriggerQuery(modelSlug, trigger));
  }

  return queries;
};

/**
 * Serializes values for use in RONIN queries.
 *
 * @param value - The value to serialize.
 *
 * @returns A string representation of the value.
 * @internal
 */
const serialize = (value: unknown): string => {
  if (typeof value === 'string') {
    // Wrap string values in single quotes
    return `'${value}'`;
  }
  if (Array.isArray(value)) {
    // Serialize each element in the array
    return `[${value.map(serialize).join(', ')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    // Serialize each key-value pair in the object
    return `{${Object.entries(value)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => `${k}:${serialize(v)}`)
      .join(', ')}}`;
  }
  // For numbers, booleans, null, undefined
  return String(value);
};

/**
 * Generates a RONIN query to rename a model.
 *
 * @param modelSlug - The current model identifier.
 * @param newModelSlug - The new model identifier.
 *
 * @returns A string representing the query.
 *
 * @example
 * ```typescript
 * renameModelQuery('user', 'account') // Output: alter.model("user").to({slug: "account"})
 * ```
 */
export const renameModelQuery = (modelSlug: string, newModelSlug: string): string => {
  return `alter.model("${modelSlug}").to({slug: "${newModelSlug}"})`;
};

/**
 * Generates a RONIN query to rename a field within a model.
 *
 * @param modelSlug - The identifier for the model.
 * @param from - The current field identifier.
 * @param to - The new field identifier.
 *
 * @returns A string representing the query.
 *
 * @example
 * ```typescript
 * renameFieldQuery('user', 'email', 'emailAddress')
 * // Output: alter.model("user").alter.field("email").to({slug: "emailAddress"})
 * ```
 */
export const renameFieldQuery = (modelSlug: string, from: string, to: string): string => {
  return `alter.model("${modelSlug}").alter.field("${from}").to({slug: "${to}"})`;
};

/**
 * Generates a RONIN query to add a trigger to a model.
 *
 * @param modelSlug - The singular identifier for the model.
 * @param trigger - The name of the trigger to add.
 *
 * @returns A string representing the query.
 */
export const createTriggerQuery = (modelSlug: string, trigger: ModelTrigger): string => {
  return `alter.model("${modelSlug}").create.trigger(${JSON.stringify(trigger)})`;
};

/**
 * Generates a RONIN query to remove a trigger from a model.
 *
 * @param modelSlug - The singular identifier for the model.
 * @param triggerName - The name of the trigger to remove.
 *
 * @returns A string representing the query.
 */
export const dropTriggerQuery = (modelSlug: string, triggerName: string): string => {
  return `alter.model("${modelSlug}").drop.trigger("${triggerName}")`;
};

/**
 * Generates a RONIN query to remove an index from a model.
 *
 * @param modelSlug - The singular identifier for the model.
 * @param indexSlug - The slug of the index to remove.
 *
 * @returns A string representing the query.
 */
export const dropIndexQuery = (modelSlug: string, indexSlug: string): string => {
  return `alter.model("${modelSlug}").drop.index("${indexSlug}")`;
};

/**
 * Generates a RONIN query to add an index to a model.
 *
 * @param modelSlug - The singular identifier for the model.
 * @param index - The index to add.
 *
 * @returns A string representing the query.
 */
export const createIndexQuery = (modelSlug: string, index: ModelIndex): string => {
  return `alter.model("${modelSlug}").create.index(${JSON.stringify(index)})`;
};
