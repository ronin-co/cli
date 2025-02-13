import type { MigrationOptions } from '@/src/utils/migration';
import { RONIN_SCHEMA_TEMP_SUFFIX } from '@/src/utils/misc';
import {
  createFieldQuery,
  createTempColumnQuery,
  createTempModelQuery,
  dropFieldQuery,
  renameFieldQuery,
} from '@/src/utils/queries';
import { confirm, input, select } from '@inquirer/prompts';
import type { ModelField, ModelIndex, ModelTrigger } from '@ronin/compiler';

/**
 * Handles migration of a required field by prompting for a default value and generating
 * the necessary queries.
 * This is needed when adding a required constraint to an existing field or creating
 * a new required field.
 *
 * @param modelSlug - The slug/identifier of the model containing the field.
 * @param field - The field being made required.
 * @param definedFields - The complete list of fields defined for the model.
 * @param options - Optional configuration.
 * @param options.requiredDefault - A predefined default value to use instead of prompting.
 *
 * @returns Object containing:
 *   - defaultValue: The chosen default value for the required field.
 *   - definedFields: Updated field definitions with required constraints temporarily removed.
 *   - queries: Array of migration queries to set default values and add required constraints.
 */
const handleRequiredField = async (
  modelSlug: string,
  field: ModelField,
  definedFields: Array<ModelField> | undefined,
  options?: MigrationOptions,
): Promise<{
  defaultValue: string | boolean | undefined;
  definedFields: Array<ModelField> | undefined;
  queries: Array<string>;
}> => {
  let defaultValue: string | boolean | undefined;
  if (field.type === 'number') {
    defaultValue =
      options?.requiredDefault ||
      (await select({
        message: `Field ${modelSlug}.${field.slug} is required. Select a default value (or manually drop all records):`,
        choices: [
          { name: 'True', value: true },
          { name: 'False', value: false },
        ],
      }));
  } else {
    defaultValue =
      options?.requiredDefault ||
      (await input({
        message: `Field ${modelSlug}.${field.slug} is required. Enter a default value (or manually drop all records):`,
      }));
  }

  // Temporarily remove required constraints to allow setting default values.
  const updatedFields = definedFields?.map((f) => ({
    ...f,
    required: false,
  }));

  const queries = [
    // Set the default value for all existing records.
    `set.RONIN_TEMP_${modelSlug}.to({${field.slug}: ${
      typeof defaultValue === 'boolean' ? defaultValue : `"${defaultValue}"`
    }})`,
    // Re-add the NOT NULL constraint after defaults are set.
    `alter.model("RONIN_TEMP_${modelSlug}").alter.field("${field.slug}").to({required: true})`,
  ];

  return {
    defaultValue,
    definedFields: updatedFields,
    queries,
  };
};

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
  options?: MigrationOptions,
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
        options?.rename ||
        (await confirm({
          message: `Did you mean to rename field: ${modelSlug}.${field.from.slug} -> ${modelSlug}.${field.to.slug}`,
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

  const createFieldsQueries = await createFields(
    fieldsToAdd,
    modelSlug,
    definedFields,
    options,
  );

  diff.push(...createFieldsQueries);
  if (
    !(
      createFieldsQueries.length > 0 &&
      createFieldsQueries.find((q) => q.includes(RONIN_SCHEMA_TEMP_SUFFIX))
    )
  ) {
    diff.push(...deleteFields(fieldsToDelete, modelSlug, definedFields));
  }

  for (const field of queriesForAdjustment || []) {
    // SQLite has limited ALTER TABLE support. When adding UNIQUE or NOT NULL constraints,
    // we must recreate the entire table. For other constraint changes, we can use a more
    // efficient approach: create a temporary column, copy the data, drop the old column,
    // and rename the temporary one.
    const existingField = existingFields.find((f) => f.slug === field.slug);
    if (field.unique || existingField?.unique) {
      diff.push(...adjustFields(modelSlug, definedFields, indexes, triggers));
    } else if (field.required) {
      const { definedFields: updatedFields, queries } = await handleRequiredField(
        modelSlug,
        field,
        definedFields,
        options,
      );

      diff.push(
        ...createTempModelQuery(
          modelSlug,
          updatedFields || [],
          [],
          [],
          queries,
          existingFields,
        ),
      );
    } else if (field.type === 'link' && field.kind === 'many') {
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
export const createFields = async (
  fields: Array<ModelField>,
  modelSlug: string,
  definedFields?: Array<ModelField>,
  options?: MigrationOptions,
): Promise<Array<string>> => {
  const diff: Array<string> = [];

  for (const fieldToAdd of fields) {
    // If the field is unique, we need to create a temporary model with the existing fields
    // and the new field. This is because SQLite doesn't support adding a UNIQUE constraint
    // to an existing column.
    if (fieldToAdd.unique) {
      const existingFields = definedFields?.filter(
        (f) => !fields.find((f2) => f2.slug === f.slug),
      );

      if (fieldToAdd.required) {
        const { definedFields: updatedFields, queries } = await handleRequiredField(
          modelSlug,
          fieldToAdd,
          definedFields,
          options,
        );

        return createTempModelQuery(
          modelSlug,
          updatedFields || [],
          [],
          [],
          queries,
          existingFields,
        );
      }

      return createTempModelQuery(
        modelSlug,
        definedFields || [],
        [],
        [],
        [],
        existingFields,
      );
    }
    // Handle required fields by prompting for default value since SQLite doesn't allow
    // adding NOT NULL columns without defaults.
    if (fieldToAdd.required) {
      const { defaultValue } = await handleRequiredField(
        modelSlug,
        fieldToAdd,
        definedFields,
        options,
      );

      // Create field without NOT NULL constraint.
      diff.push(createFieldQuery(modelSlug, { ...fieldToAdd, required: false }));
      // Now set a placeholder value.
      diff.push(
        `set.${modelSlug}.to({${fieldToAdd.slug}: ${
          typeof defaultValue === 'boolean' ? defaultValue : `"${defaultValue}"`
        }})`,
      );
      // Now add the NOT NULL constraint.
      diff.push(
        `alter.model("${modelSlug}").alter.field("${fieldToAdd.slug}").to({required: true})`,
      );
      return diff;
    }
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
const deleteFields = (
  fieldsToDrop: Array<ModelField>,
  modelSlug: string,
  fields: Array<ModelField>,
): Array<string> => {
  const diff: Array<string> = [];
  for (const fieldToDrop of fieldsToDrop) {
    if (fieldToDrop.unique) {
      return createTempModelQuery(modelSlug, fields, [], [], [], fields);
    }
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
