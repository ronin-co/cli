import type { parseArgs } from 'node:util';
import { diffFields, fieldsToAdjust } from '@/src/utils/field';
import { type BaseFlags, areArraysEqual } from '@/src/utils/misc';
import { convertModelToArrayFields } from '@/src/utils/model';
import {
  createIndexQuery,
  createModelQuery,
  createTriggerQuery,
  dropIndexQuery,
  dropModelQuery,
  dropTriggerQuery,
  renameModelQuery,
} from '@/src/utils/queries';
import { confirm } from '@inquirer/prompts';
import type { Model, ModelTrigger } from '@ronin/compiler';

/**
 * Options for migration operations.
 */
export type MigrationOptions = {
  rename?: boolean;
  requiredDefault?: boolean | string;
};

/**
 * Fields to ignore.
 * There are several fields that are not relevant for the migration process.
 */
export const IGNORED_FIELDS = [
  'id',
  'ronin',
  'ronin.updatedAt',
  'ronin.createdBy',
  'ronin.updatedBy',
  'ronin.createdAt',
  'ronin.locked',
];

/**
 * Generates the difference (migration steps) between models defined in code and models
 * in the database.
 *
 * @param definedModels - The models defined locally.
 * @param existingModels - The models defined remotely.
 * @param rename - Optional flag to automatically rename models without prompting.
 *
 * @returns An array of migration steps (as code strings).
 */
export const diffModels = async (
  definedModelsWithFieldObject: Array<Model>,
  existingModelsWithFieldObject: Array<Model>,
  options?: MigrationOptions,
): Promise<Array<string>> => {
  const definedModels = definedModelsWithFieldObject.map((model) =>
    convertModelToArrayFields(model),
  );
  const existingModels = existingModelsWithFieldObject.map((model) =>
    convertModelToArrayFields(model),
  );

  const diff: Array<string> = [];

  const adjustModelMetaQueries = adjustModelMeta(definedModels, existingModels);
  const recreateIndexes = indexesToRecreate(definedModels, existingModels);
  const recreateTriggers = triggersToRecreate(definedModels, existingModels);

  const modelsToBeRenamed = modelsToRename(definedModels, existingModels);
  let modelsToBeAdded = modelsToAdd(definedModels, existingModels);
  let modelsToBeDropped = modelsToDrop(definedModels, existingModels);

  if (modelsToBeRenamed.length > 0) {
    // Ask if the user wants to rename the models
    for (const model of modelsToBeRenamed) {
      const confirmRename =
        options?.rename ||
        (process.env.NODE_ENV !== 'test' &&
          (await confirm({
            message: `Did you mean to rename model: ${model.from.slug} -> ${model.to.slug}`,
            default: true,
          })));

      if (confirmRename) {
        modelsToBeDropped = modelsToBeDropped.filter((s) => s.slug !== model.from.slug);
        modelsToBeAdded = modelsToBeAdded.filter((s) => s.slug !== model.to.slug);
        diff.push(renameModelQuery(model.from.slug, model.to.slug));
      }
    }
  }

  diff.push(...adjustModelMetaQueries);
  diff.push(...dropModels(modelsToBeDropped));
  diff.push(...createModels(modelsToBeAdded));
  diff.push(...(await adjustModels(definedModels, existingModels, options)));
  diff.push(...recreateIndexes);
  diff.push(...recreateTriggers);

  return diff;
};

/**
 * Adjusts models by determining the differences in fields between models defined in code
 * and those defined in the database.
 *
 * @param definedModels - The models defined locally.
 * @param existingModels - The models defined in the database.
 * @param rename - Optional flag to automatically rename fields without prompting.
 *
 * @returns An array of field adjustments as code strings.
 */
const adjustModels = async (
  definedModels: Array<Model>,
  existingModels: Array<Model>,
  options?: MigrationOptions,
): Promise<Array<string>> => {
  const diff: Array<string> = [];

  // Adjust models
  for (const localModel of definedModels) {
    const remoteModel = existingModels.find((r) => r.slug === localModel.slug);
    if (remoteModel) {
      diff.push(
        ...(await diffFields(
          localModel.fields || [],
          remoteModel.fields || [],
          localModel.slug,
          localModel.indexes || [],
          localModel.triggers || [],
          options,
        )),
      );
    }
  }

  return diff;
};

/**
 * Generates queries to delete models from the database.
 *
 * @param models - An array of models to delete.
 *
 * @returns An array of deletion queries as code strings.
 */
export const dropModels = (models: Array<Model>): Array<string> => {
  const diff: Array<string> = [];
  for (const model of models) {
    // Queries for deleting the model.
    // Fields are deleted automatically due to CASCADE ON DELETE.
    diff.push(dropModelQuery(model.slug));
  }
  return diff;
};

/**
 * Generates queries to create models in the database.
 *
 * @param models - An array of models to create.
 *
 * @returns An array of creation queries as code strings.
 */
export const createModels = (models: Array<Model>): Array<string> => {
  const diff: Array<string> = [];

  for (const model of models) {
    diff.push(
      createModelQuery(model.slug, model.fields ? { fields: model.fields } : undefined),
    );
  }

  return diff;
};

/**
 * Filters models defined in code that are missing in the database.
 *
 * @param definedModels - The models defined locally.
 * @param existingModels - The models currently defined in the database.
 *
 * @returns An array of models to delete.
 */
export const modelsToDrop = (
  definedModels: Array<Model>,
  existingModels: Array<Model>,
): Array<Model> => {
  return existingModels.filter((s) => !definedModels.some((c) => c.slug === s.slug));
};

/**
 * Filters models that need to be added to the database as they are defined locally
 * but absent remotely.
 *
 * @param definedModels - The models defined locally.
 * @param existingModels - The models currently defined in the database.
 *
 * @returns An array of models to add.
 */
export const modelsToAdd = (
  definedModels: Array<Model>,
  existingModels: Array<Model>,
): Array<Model> => {
  const currentModelsMap = new Map(existingModels.map((s) => [s.slug, s]));
  const newModels: Array<Model> = [];

  for (const model of definedModels) {
    if (!currentModelsMap.has(model.slug)) {
      newModels.push(model);
    }
  }

  return newModels;
};

/**
 * Filters models that need to be renamed in the database.
 *
 * @param definedModels - The models defined locally.
 * @param existingModels - The models currently defined in the database.
 *
 * @returns An array of objects containing the old and new model definitions.
 */
export const modelsToRename = (
  definedModels: Array<Model>,
  existingModels: Array<Model>,
): Array<{ to: Model; from: Model }> => {
  const modelsToBeAdded = modelsToAdd(definedModels, existingModels);
  const modelsToBeDropped = modelsToDrop(definedModels, existingModels);

  const modelsToRename: Array<{ to: Model; from: Model }> = [];

  for (const model of modelsToBeAdded) {
    // Check if `model.fields` has the same fields as the current model
    const currentModel = modelsToBeDropped.find((s) => {
      return areArraysEqual(
        model.fields?.map((f) => f.slug) || [],
        s.fields?.map((f) => f.slug) || [],
      );
    });
    if (currentModel) {
      modelsToRename.push({ to: model, from: currentModel });
    }
  }

  return modelsToRename;
};

/**
 * Generates queries to adjust model metadata like name and ID prefix.
 *
 * @param definedModels - The models defined locally.
 * @param existingModels - The models currently defined in the database.
 *
 * @returns An array of model metadata adjustment queries as code strings.
 */
export const adjustModelMeta = (
  definedModels: Array<Model>,
  existingModels: Array<Model>,
): Array<string> => {
  const databaseModelsMap = new Map(existingModels.map((s) => [s.slug, s]));
  const newModels: Array<string> = [];

  for (const model of definedModels) {
    const currentModel = databaseModelsMap.get(model.slug);
    if (!(model.name && model.idPrefix)) continue;
    if (
      currentModel &&
      (model.name !== currentModel.name || model.idPrefix !== currentModel.idPrefix)
    ) {
      newModels.push(
        `alter.model("${model.slug}").to({name: "${model.name}", idPrefix: "${model.idPrefix}"})`,
      );
    }
  }

  return newModels;
};

/**
 * Generates queries to recreate triggers for models.
 *
 * @param definedModels - The models defined locally.
 * @param existingModels - The models currently defined in the database.
 *
 * @returns An array of trigger recreation queries as code strings.
 */
export const triggersToRecreate = (
  definedModels: Array<Model>,
  existingModels: Array<Model>,
): Array<string> => {
  const diff: Array<string> = [];

  for (const definedModel of definedModels) {
    const existingModel = existingModels.find((m) => m.slug === definedModel.slug);
    const modelRecreated = modelWillBeRecreated(
      definedModel,
      existingModel || ({} as Model),
    );

    // find triggers with the same slug and if they have different properties we need to drop and create
    const needRecreation = Object.entries(definedModel.triggers || {}).reduce<
      Array<string>
    >((acc, [slug, trigger]) => {
      const existingTrigger = existingModel?.triggers?.[slug];
      if (
        existingTrigger &&
        !(JSON.stringify(trigger) === JSON.stringify(existingTrigger))
      ) {
        const createTrigger = createTriggerQuery(definedModel.slug, {
          [slug]: {
            ...trigger,
          },
        });
        const dropTrigger = dropTriggerQuery(definedModel.slug, slug);
        acc.push(dropTrigger);
        acc.push(createTrigger);
        return acc;
      }
      if (definedModel.triggers?.[slug] && !existingModel?.triggers?.[slug]) {
        acc.push(
          createTriggerQuery(definedModel.slug, {
            [slug]: {
              ...trigger,
            },
          }),
        );
      }
      return acc;
    }, []);

    diff.push(...(modelRecreated ? [] : needRecreation));
  }

  return diff;
};

/**
 * Generates queries to drop triggers from a model.
 *
 * @param definedModel - The model defined locally.
 * @param existingModel - The model currently defined in the database.
 *
 * @returns An array of trigger deletion queries as code strings.
 */
export const dropTriggers = (
  definedModel: Model,
  existingModel: Model,
): Array<string> => {
  const diff: Array<string> = [];
  const definedTriggerKeys = Object.keys(definedModel.triggers || {});
  const existingTriggerKeys = Object.keys(existingModel.triggers || {});

  const triggersToDrop = existingTriggerKeys.filter(
    (key) => !definedTriggerKeys.includes(key),
  );

  for (const trigger of triggersToDrop) {
    diff.push(dropTriggerQuery(definedModel.slug, trigger));
  }

  return diff;
};

/**
 * Generates queries to create triggers for a model.
 *
 * @param definedModel - The model defined locally.
 * @param existingModel - The model currently defined in the database.
 *
 * @returns An array of trigger creation queries as code strings.
 */
export const createTriggers = (
  definedModel: Model,
  existingModel: Model,
): Array<string> => {
  const diff: Array<string> = [];
  const definedTriggerKeys = Object.keys(definedModel.triggers || {});
  const existingTriggerKeys = Object.keys(existingModel.triggers || {});

  const triggersToAdd = definedTriggerKeys.filter(
    (key) => !existingTriggerKeys.includes(key),
  );

  for (const trigger of triggersToAdd) {
    diff.push(
      createTriggerQuery(definedModel.slug, {
        [trigger]: definedModel.triggers[trigger],
      }),
    );
  }

  return diff;
};

/**
 * Checks if a model needs to be recreated due to field changes.
 *
 * @param definedModel - The model defined locally.
 * @param existingModel - The model currently defined in the database.
 *
 * @returns True if the model needs recreation, false otherwise.
 */
export const modelWillBeRecreated = (
  definedModel: Model,
  existingModel: Model,
): boolean => {
  if (!existingModel) return false;
  return (
    (fieldsToAdjust(definedModel.fields || [], existingModel.fields || []) ?? []).length >
    0
  );
};

/**
 * Generates queries to recreate indexes for models.
 *
 * @param definedModels - The models defined locally.
 * @param existingModels - The models currently defined in the database.
 *
 * @returns An array of index recreation queries as code strings.
 */
export const indexesToRecreate = (
  definedModels: Array<Model>,
  existingModels: Array<Model>,
): Array<string> => {
  const diff: Array<string> = [];

  for (const definedModel of definedModels) {
    const existingModel = existingModels.find((m) => m.slug === definedModel.slug);
    const modelRecreated = modelWillBeRecreated(
      definedModel,
      existingModel || ({} as Model),
    );

    // find indexes with the same slug and if they have different properties we need to drop and create
    const needRecreation = Object.entries(definedModel.indexes || {}).reduce<
      Array<string>
    >((acc, [slug, index]) => {
      const existingIndex = existingModel?.indexes?.[slug];
      if (existingIndex && !(JSON.stringify(index) === JSON.stringify(existingIndex))) {
        const createIndex = createIndexQuery(definedModel.slug, {
          [slug]: {
            ...index,
          },
        });
        const dropIndex = dropIndexQuery(definedModel.slug, slug);
        acc.push(dropIndex);
        acc.push(createIndex);
        return acc;
      }
      if (definedModel.indexes?.[slug] && !existingModel?.indexes?.[slug]) {
        acc.push(
          createIndexQuery(definedModel.slug, {
            [slug]: {
              ...index,
            },
          }),
        );
      }
      return acc;
    }, []);

    diff.push(...(modelRecreated ? [] : needRecreation));
  }

  return diff;
};

/**
 * Generates queries to drop indexes from a model.
 *
 * @param definedModel - The model defined locally.
 * @param existingModel - The model currently defined in the database.
 *
 * @returns An array of index deletion queries as code strings.
 */
export const dropIndexes = (definedModel: Model, existingModel: Model): Array<string> => {
  const diff: Array<string> = [];
  const definedIndexKeys = Object.keys(definedModel.indexes || {});
  const existingIndexKeys = Object.keys(existingModel.indexes || {});

  const indexesToDrop = existingIndexKeys.filter(
    (key) => !definedIndexKeys.includes(key),
  );

  for (const index of indexesToDrop) {
    diff.push(dropIndexQuery(definedModel.slug, index));
  }

  return diff;
};

/**
 * Generates queries to create indexes for a model.
 *
 * @param definedModel - The model defined locally.
 * @param existingModel - The model currently defined in the database.
 *
 * @returns An array of index creation queries as code strings.
 */
export const createIndexes = (
  definedModel: Model,
  existingModel: Model,
): Array<string> => {
  const diff: Array<string> = [];
  const definedIndexKeys = Object.keys(definedModel.indexes || {});
  const existingIndexKeys = Object.keys(existingModel.indexes || {});

  const indexesToAdd = definedIndexKeys.filter((key) => !existingIndexKeys.includes(key));

  for (const index of indexesToAdd) {
    diff.push(
      createIndexQuery(definedModel.slug, { [index]: definedModel.indexes[index] }),
    );
  }

  return diff;
};

/**
 * Command line flags for migration operations.
 */
export const MIGRATION_FLAGS = {
  sql: { type: 'boolean', short: 's', default: false },
  local: { type: 'boolean', short: 'l', default: false },
  apply: { type: 'boolean', short: 'a', default: false },
} satisfies NonNullable<Parameters<typeof parseArgs>[0]>['options'];

/**
 * Type definition for migration command flags.
 */
export type MigrationFlags = BaseFlags &
  Partial<Record<keyof typeof MIGRATION_FLAGS, boolean>>;
