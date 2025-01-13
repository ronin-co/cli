import type { parseArgs } from 'node:util';
import { diffFields, fieldsToAdjust } from '@/src/utils/field';
import { type BaseFlags, areArraysEqual } from '@/src/utils/misc';
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
import type { Model } from '@ronin/compiler';

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
 *
 * @returns An array of migration steps (as code strings).
 */
export const diffModels = async (
  definedModels: Array<Model>,
  existingModels: Array<Model>,
  rename?: boolean,
): Promise<Array<string>> => {
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
        rename ||
        (process.env.NODE_ENV !== 'test' &&
          (await confirm({
            message: `Did you mean to rename model: ${model.from.slug} -> ${model.to.slug}`,
            default: false,
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
  diff.push(...(await adjustModels(definedModels, existingModels, rename)));
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
 *
 * @returns An array of field adjustments as code strings.
 */
const adjustModels = async (
  definedModels: Array<Model>,
  existingModels: Array<Model>,
  rename?: boolean,
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
          rename,
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
    diff.push(createModelQuery(model.slug, { fields: model.fields || [] }));
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
 * Filters models that need to be added to the database as they are defined locally but absent remotely.
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
 * @returns An array of models to rename.
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
      definedModel.slug,
    );

    diff.push(
      ...(modelRecreated
        ? []
        : dropTriggers(definedModel, existingModel || ({} as Model))),
      ...createTriggers(definedModel, existingModel || ({} as Model)),
    );
  }

  return diff;
};

export const dropTriggers = (
  definedModel: Model,
  existingModel: Model,
): Array<string> => {
  const diff: Array<string> = [];
  const definedTriggers = definedModel.triggers || [];
  const existingTriggers = existingModel.triggers || [];

  // Find every trigger that exists but not in defined
  const triggersToDrop =
    existingTriggers.filter(
      (i) =>
        !definedTriggers.some(
          (d) =>
            d.fields &&
            i.fields &&
            d.fields.length === i.fields.length &&
            d.fields.every(
              (f, idx) => JSON.stringify(f) === JSON.stringify(i.fields?.[idx]),
            ),
        ),
    ) || [];

  for (const trigger of triggersToDrop) {
    diff.push(dropTriggerQuery(definedModel.slug, trigger.slug || 'no slug'));
  }

  return diff;
};

export const createTriggers = (
  definedModel: Model,
  existingModel: Model,
): Array<string> => {
  const diff: Array<string> = [];
  const definedTriggers = definedModel.triggers || [];
  const existingTriggers = existingModel.triggers || [];

  // Find every trigger that is defined but not in existing
  const triggersToAdd = definedTriggers.filter(
    (i) =>
      !existingTriggers.some(
        (e) =>
          e?.fields &&
          i.fields &&
          e.fields.length === i.fields.length &&
          e.fields.every(
            (f, idx) => JSON.stringify(f) === JSON.stringify(i.fields?.[idx]),
          ),
      ),
  );

  for (const trigger of triggersToAdd) {
    diff.push(createTriggerQuery(definedModel.slug, trigger));
  }

  return diff;
};

export const modelWillBeRecreated = (
  definedModel: Model,
  existingModel: Model,
  slug: string,
): boolean => {
  if (!existingModel) return false;
  return (
    (fieldsToAdjust(definedModel.fields || [], existingModel.fields || [], slug) ?? [])
      .length > 0
  );
};

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
      definedModel.slug,
    );

    diff.push(
      ...(modelRecreated
        ? []
        : dropIndexes(definedModel, existingModel || ({} as Model))),
      ...createIndexes(definedModel, existingModel || ({} as Model)),
    );
  }
  return diff;
};

export const dropIndexes = (definedModel: Model, existingModel: Model): Array<string> => {
  const diff: Array<string> = [];
  const definedIndexes = definedModel.indexes || [];

  // Find every index that exists but not in defined
  const indexesToDrop =
    existingModel?.indexes?.filter(
      (i) =>
        !definedIndexes.some(
          (d) =>
            d.fields &&
            i.fields &&
            d.fields.length === i.fields.length &&
            d.unique === i.unique &&
            d.fields.every(
              (f, idx) => JSON.stringify(f) === JSON.stringify(i.fields[idx]),
            ),
        ),
    ) || [];

  for (const index of indexesToDrop) {
    diff.push(dropIndexQuery(definedModel.slug, index.slug || 'no slug'));
  }

  return diff;
};

export const createIndexes = (
  definedModel: Model,
  existingModel: Model,
): Array<string> => {
  const diff: Array<string> = [];
  const definedIndexes = definedModel.indexes || [];
  const existingIndexes = existingModel.indexes || [];

  // Find every index that is defined but not in `existingIndexes`
  const indexesToAdd = definedIndexes.filter(
    (i) =>
      !existingIndexes.some(
        (e) =>
          e.fields &&
          i.fields &&
          e.fields.length === i.fields.length &&
          e.unique === i.unique &&
          e.fields.every((f, idx) => JSON.stringify(f) === JSON.stringify(i.fields[idx])),
      ),
  );

  for (const index of indexesToAdd) {
    diff.push(createIndexQuery(definedModel.slug, index));
  }

  return diff;
};

export const MIGRATION_FLAGS = {
  sql: { type: 'boolean', short: 's', default: false },
  local: { type: 'boolean', short: 'l', default: false },
  apply: { type: 'boolean', short: 'a', default: false },
} satisfies NonNullable<Parameters<typeof parseArgs>[0]>['options'];

export type MigrationFlags = BaseFlags &
  Partial<Record<keyof typeof MIGRATION_FLAGS, boolean>>;
