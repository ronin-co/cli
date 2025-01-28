import { RONIN_SCHEMA_TEMP_SUFFIX } from '@/src/utils/misc';
import {
  createFieldQuery,
  createTempColumnQuery,
  createTempModelQuery,
  dropFieldQuery,
  renameFieldQuery,
} from '@/src/utils/queries';
import { confirm } from '@inquirer/prompts';
import type { ModelField, ModelIndex, ModelTrigger } from '@ronin/compiler';

/**
 * Generates the difference (migration steps) between local and remote fields of a model.
 *
 * @param definedFields - The fields defined locally.
 * @param existingFields - The fields defined remotely.
 * @param modelSlug - The slug of the model being compared.
 *
 * @returns An array of migration steps (as SQL query strings).
 */
export const diffFields = async (
  definedFields: Array<ModelField>,
  existingFields: Array<ModelField>,
  modelSlug: string,
  indexes: Array<ModelIndex>,
  triggers: Array<ModelTrigger>,
  rename?: boolean,
): Promise<Array<string>> => {
  const diff: Array<string> = [];

  const fieldsToBeRenamed = fieldsToRename(definedFields, existingFields);

  let fieldsToAdd = fieldsToCreate(definedFields, existingFields);
  let fieldsToDelete = fieldsToDrop(definedFields, existingFields);
  const queriesForAdjustment = fieldsToAdjust(definedFields, existingFields);

  if (fieldsToBeRenamed.length > 0) {
    // Ask if the user wants to rename a field.
    for (const field of fieldsToBeRenamed) {
      const confirmRename =
        rename ||
        (await confirm({
          message: `Did you mean to rename field: ${field.from.slug} -> ${field.to.slug}`,
          default: true,
        }));

      if (confirmRename) {
        fieldsToDelete = fieldsToDelete.filter((s) => s.slug !== field.from.slug);
        fieldsToAdd = fieldsToAdd.filter((s) => s.slug !== field.to.slug);
        if (field.from.type === 'link') {
          diff.push(
            ...createTempModelQuery(
              modelSlug,
              [
                { ...field.to, slug: field.from.slug },
                ...definedFields.filter((local) => local.slug !== field.to.slug),
              ],
              indexes,
              triggers,
              [
                renameFieldQuery(
                  `${RONIN_SCHEMA_TEMP_SUFFIX}${modelSlug}`,
                  field.from.slug,
                  field.to.slug,
                ),
              ],
            ),
          );
        } else {
          diff.push(renameFieldQuery(modelSlug, field.from.slug, field.to.slug));
        }
      }
    }
  }

  diff.push(...createFields(fieldsToAdd, modelSlug));
  diff.push(...deleteFields(fieldsToDelete, modelSlug));

  for (const field of queriesForAdjustment || []) {
    // SQLite's ALTER TABLE is limited - adding UNIQUE or NOT NULL to an existing column
    // requires recreating the entire table. For other constraint changes, we can use a
    // temporary column approach (create temp, copy data, drop old, rename temp).
    const existingField = existingFields.find((f) => f.slug === field.slug);
    if (field.unique || field.required || existingField?.unique) {
      diff.push(...adjustFields(modelSlug, definedFields, indexes, triggers));
    } else {
      diff.push(...createTempColumnQuery(modelSlug, field, indexes, triggers));
    }
  }

  return diff;
};

/**
 * Determines the fields that need to be renamed.
 *
 * @param definedFields - The fields defined locally.
 * @param existingFields - The fields defined remotely.
 *
 * @returns An array of fields to rename.
 */
export const fieldsToRename = (
  definedFields: Array<ModelField>,
  existingFields: Array<ModelField>,
): Array<{ from: ModelField; to: ModelField }> => {
  const fieldsToCreated = fieldsToCreate(definedFields, existingFields);
  let fieldsToDropped = fieldsToDrop(definedFields, existingFields);

  const fieldsToRename: Array<{ from: ModelField; to: ModelField }> = [];

  for (const field of fieldsToCreated) {
    const currentField = fieldsToDropped.find(
      (s) =>
        JSON.stringify({
          type: field.type,
          unique: field.unique,
          required: field.required,
        }) ===
        JSON.stringify({
          type: s.type,
          unique: s.unique,
          required: s.required,
        }),
    );

    if (currentField) {
      fieldsToRename.push({ from: currentField, to: field });
      fieldsToDropped = fieldsToDropped.filter((s) => s.slug !== currentField.slug);
    }
  }

  return fieldsToRename;
};

/**
 * Determines the necessary adjustments for model fields to have code match the database.
 *
 * @param definedFields - Model fields defined in the code.
 * @param existingFields - Model fields in the database.
 * @param modelSlug - Slug for the model.
 *
 * @returns An array of SQL queries for adjustment, or `undefined` if none are needed.
 */
export const fieldsToAdjust = (
  definedFields: Array<ModelField>,
  existingFields: Array<ModelField>,
): Array<ModelField> | undefined => {
  const diff: Array<ModelField> = [];
  let needsAdjustment = false;

  for (const local of definedFields) {
    const remote = existingFields.find((r) => r.slug === local.slug);
    if (remote && fieldsAreDifferent(local, remote)) {
      needsAdjustment = true;
      diff.push(local);
    }
  }

  return needsAdjustment ? diff : undefined;
};

/**
 * Creates a temporary table to handle field adjustments in SQLite. Since SQLite doesn't
 * support direct column alterations (except for renaming), the function:
 *
 * 1. Creates a temporary table with the new model
 * 2. Copies data from original table
 * 3. Drops the original table
 * 4. Renames the temporary table to the original name
 * 5. Recreates indexes
 *
 * @param modelSlug - Slug of the model being adjusted.
 * @param fields - Array of fields with their new definitions.
 * @param indexes - Array of indexes to recreate after table swap.
 *
 * @returns Array of SQL queries to perform the table recreation.
 */
const adjustFields = (
  modelSlug: string,
  fields: Array<ModelField>,
  indexes: Array<ModelIndex>,
  triggers: Array<ModelTrigger>,
): Array<string> => {
  return createTempModelQuery(modelSlug, fields, indexes, triggers);
};

/**
 * Identifies fields that need to be created in the database.
 *
 * @param definedFields - Fields defined in the code.
 * @param existingFields - Fields present in the database.
 *
 * @returns An array of fields to create in the database.
 */
export const fieldsToCreate = (
  definedFields: Array<ModelField>,
  existingFields: Array<ModelField>,
): Array<ModelField> => {
  return definedFields.filter(
    (field) => !existingFields.find((remote) => remote.slug === field.slug),
  );
};

/**
 * Generates SQL queries to create new fields in the database.
 *
 * @param fields - Fields to add to the database.
 * @param modelSlug - Slug of the model.
 *
 * @returns An array of SQL queries for creating fields.
 */
export const createFields = (
  fields: Array<ModelField>,
  modelSlug: string,
): Array<string> => {
  const diff: Array<string> = [];

  for (const fieldToAdd of fields) {
    diff.push(createFieldQuery(modelSlug, fieldToAdd));
  }

  return diff;
};

/**
 * Identifies fields that should be removed from the database.
 *
 * @param definedFields - Fields defined in the code.
 * @param existingFields - Fields present in the database.
 *
 * @returns An array of fields to remove from the database.
 */
export const fieldsToDrop = (
  definedFields: Array<ModelField>,
  existingFields: Array<ModelField>,
): Array<ModelField> => {
  return existingFields.filter(
    (field) => !definedFields.find((local) => local.slug === field.slug),
  );
};

/**
 * Generates SQL queries to delete fields from the database.
 *
 * @param fields - Fields to delete.
 * @param modelSlug - Slug of the model.
 *
 * @returns An array of SQL queries for deleting fields.
 */
const deleteFields = (fields: Array<ModelField>, modelSlug: string): Array<string> => {
  const diff: Array<string> = [];

  for (const fieldToDrop of fields) {
    diff.push(dropFieldQuery(modelSlug, fieldToDrop.slug));
  }

  return diff;
};

/**
 * Compares two fields to determine if they are different.
 *
 * @param local - The local field definition.
 * @param remote - The remote field definition.
 *
 * @returns True if the fields are different, false otherwise.
 */
export const fieldsAreDifferent = (local: ModelField, remote: ModelField): boolean => {
  const { name: localName, ...localAttributes } = local;
  const { name: remoteName, ...remoteAttributes } = remote;

  return (
    (localName && localName !== remoteName) ||
    JSON.stringify(localAttributes) !== JSON.stringify(remoteAttributes)
  );
};
