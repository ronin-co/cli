import type { parseArgs } from 'node:util';
import { CompareModels } from '@/src/utils/field';
import { type BaseFlags, areArraysEqual } from '@/src/utils/misc';
import {
  type ModelWithFieldsArray,
  convertModelToArrayFields,
  convertModelToObjectFields,
} from '@/src/utils/model';
import {
  type Queries,
  createIndexQuery,
  createModelQuery,
  createTempModelQuery,
  createTriggerQuery,
  dropIndexQuery,
  dropModelQuery,
  dropTriggerQuery,
  renameModelQuery,
} from '@/src/utils/queries';
import { confirm } from '@inquirer/prompts';
import type { Model } from '@ronin/compiler';

/**
 * Options for migration operations.
 */
export interface MigrationOptions {
  /** Whether to automatically rename models without prompting. */
  rename?: boolean;
  /** Default value to use for required fields. */
  requiredDefault?: boolean | string;
  /** Whether to debug the migration process. */
  debug?: boolean;
}

/**
 * Options for migration operations that include model name and plural name.
 */
export interface MigrationOptionsWithName extends MigrationOptions {
  name?: string;
  pluralName?: string;
}

/**
 * Fields to ignore during migration.
 * These fields are not relevant for the migration process.
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
 * Command line flags for migration operations.
 */
export const MIGRATION_FLAGS = {
  sql: { type: 'boolean', short: 's', default: false },
  local: { type: 'boolean', short: 'l', default: false },
  apply: { type: 'boolean', short: 'a', default: false },
  'skip-types': { type: 'boolean', default: false },
  'force-drop': { type: 'boolean', short: 'd', default: false },
  'force-create': { type: 'boolean', short: 'c', default: false },
} satisfies NonNullable<Parameters<typeof parseArgs>[0]>['options'];

/**
 * Type definition for migration command flags.
 */
export type MigrationFlags = BaseFlags &
  Partial<Record<keyof typeof MIGRATION_FLAGS, boolean>>;

/**
 * Class for generating migration queries.
 */
export class Migration {
  queries: Queries = [];

  #definedModelsWithFieldsArray: Array<ModelWithFieldsArray> = [];
  #existingModelsWithFieldsArray: Array<ModelWithFieldsArray> = [];

  options?: MigrationOptions;

  constructor(
    definedModels?: Array<Model>,
    existingModels?: Array<Model>,
    options?: MigrationOptions,
  ) {
    this.#definedModelsWithFieldsArray =
      definedModels?.map((model) => convertModelToArrayFields(model)) || [];
    this.#existingModelsWithFieldsArray =
      existingModels?.map((model) => convertModelToArrayFields(model)) || [];
    this.options = options;
  }

  /**
   * Generates the difference (migration steps) between models defined in code and models
   * in the database.
   *
   * @returns An array of migration steps (as code strings).
   */
  async diff(): Promise<Queries> {
    const queries: Queries = [];
    // Handle the models that need to be renamed.
    // All models that have been renamed are not eligible to be dropped or created.
    // Because models are eligible for renaming, if the fields are equal.
    // So we can exclude those models from the defined and existing models arrays.
    // However, the renamed models are still eligible for meta property changes.
    const {
      queries: renameQueries,
      exludeFromAdded,
      exludeFromDropped,
    } = await this.renameModels(
      this.modelsToRename(
        this.#definedModelsWithFieldsArray,
        this.#existingModelsWithFieldsArray,
      ),
      this.options,
    );
    queries.push(...renameQueries);

    // Handle the models that are not in the database but are defined in code.
    queries.push(
      ...this.createModels(
        this.modelsToAdd(
          this.#definedModelsWithFieldsArray,
          this.#existingModelsWithFieldsArray,
          exludeFromAdded,
        ),
      ),
    );

    // Handle the models that are in the database but are not defined in code.
    queries.push(
      ...this.dropModels(
        this.modelsToDrop(
          this.#definedModelsWithFieldsArray,
          this.#existingModelsWithFieldsArray,
          exludeFromDropped,
        ),
      ),
    );

    // Handle cases where only the meta properties are changed.
    queries.push(
      ...this.adjustModelsMeta(
        this.#definedModelsWithFieldsArray,
        this.#existingModelsWithFieldsArray,
      ),
    );

    // Handle the models that are in the database and are defined in code but require
    // changes.
    queries.push(
      ...(await this.adjustModels(
        this.#definedModelsWithFieldsArray,
        this.#existingModelsWithFieldsArray,
        this.options,
      )),
    );

    // If triggers or indexes are changed we need to drop the existing ones and create the new ones.
    queries.push(
      ...this.indexesToRecreate(
        this.#definedModelsWithFieldsArray,
        this.#existingModelsWithFieldsArray,
      ),
    );
    queries.push(
      ...this.triggersToRecreate(
        this.#definedModelsWithFieldsArray,
        this.#existingModelsWithFieldsArray,
      ),
    );

    this.queries = queries;
    return queries;
  }

  /**
   * Renames models based on the provided mapping of old to new models.
   *
   * @param modelsToBeRenamed - An array of objects containing the mapping between old (from) and new (to) models.
   * @param options - Optional configuration for the migration process.
   *
   * @returns An object containing:
   *   - queries: RONIN queries needed to perform the rename operations.
   *   - exludeFromAdded: Models that should be excluded from being added (as they're just renamed).
   *   - exludeFromDropped: Models that should be excluded from being dropped (as they're just renamed).
   */
  async renameModels(
    modelsToBeRenamed: Array<{ to: ModelWithFieldsArray; from: ModelWithFieldsArray }>,
    options?: MigrationOptions,
  ): Promise<{
    queries: Array<string>;
    exludeFromAdded?: Array<ModelWithFieldsArray>;
    exludeFromDropped?: Array<ModelWithFieldsArray>;
  }> {
    const queries: Array<string> = [];
    const exludeFromAdded: Array<ModelWithFieldsArray> = [];
    const exludeFromDropped: Array<ModelWithFieldsArray> = [];

    if (modelsToBeRenamed.length === 0) {
      return { queries: [] };
    }

    for (const model of modelsToBeRenamed) {
      const confirmRename =
        options?.rename ||
        (await confirm({
          message: `Did you mean to rename model: ${model.from.slug} -> ${model.to.slug}`,
          default: true,
        }));

      if (confirmRename) {
        exludeFromAdded.push(model.to);
        exludeFromDropped.push(model.from);
        queries.push(renameModelQuery(model.from.slug, model.to.slug));
      }
    }

    return { queries, exludeFromAdded, exludeFromDropped };
  }

  /**
   * Adjusts models by determining the differences in fields between models defined in code
   * and those defined in the database.
   *
   * @param definedModels - The models defined locally.
   * @param existingModels - The models defined in the database.
   * @param options - Optional configuration for migration behavior.
   *
   * @returns An array of field adjustments as code strings.
   */
  async adjustModels(
    definedModels: Array<ModelWithFieldsArray>,
    existingModels: Array<ModelWithFieldsArray>,
    options?: MigrationOptions,
  ): Promise<Array<string>> {
    const queries: Array<string> = [];
    for (const localModel of definedModels) {
      const remoteModel = existingModels.find((r) => r.slug === localModel.slug);

      if (remoteModel) {
        queries.push(
          ...(await new CompareModels(localModel, remoteModel, {
            ...options,
            name: remoteModel.name,
            pluralName: remoteModel.pluralName,
          }).diff()),
        );
      }
    }

    return queries;
  }

  /**
   * Generates queries to delete models from the database.
   *
   * @param models - An array of models to delete.
   *
   * @returns An array of deletion queries as code strings.
   */
  dropModels(models: Array<Model>): Array<string> {
    const queries: Array<string> = [];
    for (const model of models) {
      // Queries for deleting the model.
      // Fields are deleted automatically due to CASCADE ON DELETE.
      queries.push(dropModelQuery(model.slug));
    }
    return queries;
  }

  /**
   * Generates queries to create models in the database.
   *
   * @param models - An array of models to create.
   *
   * @returns An array of creation queries as code strings.
   */
  createModels(models: Array<Model>): Array<string> {
    const queries: Array<string> = [];
    for (const model of models) {
      queries.push(createModelQuery(model));
    }

    return queries;
  }

  /**
   * Filters models defined in code that are missing in the database.
   *
   * @param definedModels - The models defined locally.
   * @param existingModels - The models currently defined in the database.
   *
   * @returns An array of models to delete.
   */
  modelsToDrop(
    definedModels: Array<ModelWithFieldsArray>,
    existingModels: Array<ModelWithFieldsArray>,
    exludeFromAdded?: Array<ModelWithFieldsArray>,
  ): Array<Model> {
    return existingModels
      .filter((s) => !definedModels.some((c) => c.slug === s.slug))
      .filter((s) => !exludeFromAdded?.some((c) => c.slug === s.slug))
      .map((s) => convertModelToObjectFields(s));
  }

  /**
   * Filters models that need to be added to the database as they are defined locally
   * but absent remotely.
   *
   * @param definedModels - The models defined locally.
   * @param existingModels - The models currently defined in the database.
   *
   * @returns An array of models to add.
   */
  modelsToAdd(
    definedModels: Array<ModelWithFieldsArray>,
    existingModels: Array<ModelWithFieldsArray>,
    exludeFromDropped?: Array<ModelWithFieldsArray>,
  ): Array<Model> {
    const currentModelsMap = new Map(existingModels.map((s) => [s.slug, s]));
    const models: Array<Model> = [];

    for (const model of definedModels) {
      if (
        !(
          currentModelsMap.has(model.slug) ||
          exludeFromDropped?.some((c) => c.slug === model.slug)
        )
      ) {
        models.push(convertModelToObjectFields(model));
      }
    }

    return models;
  }

  /**
   * Filters models that need to be renamed in the database.
   *
   * @param definedModels - The models defined locally.
   * @param existingModels - The models currently defined in the database.
   *
   * @returns An array of objects containing the old and new model definitions.
   */
  modelsToRename(
    definedModels: Array<ModelWithFieldsArray>,
    existingModels: Array<ModelWithFieldsArray>,
  ): Array<{ to: ModelWithFieldsArray; from: ModelWithFieldsArray }> {
    const modelsToBeAdded = this.modelsToAdd(definedModels, existingModels).map((model) =>
      convertModelToArrayFields(model),
    );
    const modelsToBeDropped = this.modelsToDrop(definedModels, existingModels).map(
      (model) => convertModelToArrayFields(model),
    );

    const modelsToRename: Array<{
      to: ModelWithFieldsArray;
      from: ModelWithFieldsArray;
    }> = [];

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
  }

  /**
   * Generates queries to adjust model metadata like name and ID prefix.
   *
   * @param definedModel - The model defined locally.
   * @param existingModel - The model currently defined in the database.
   *
   * @returns An array of model metadata adjustment queries as code strings.
   */
  adjustModelMeta(
    definedModel: ModelWithFieldsArray,
    existingModel: ModelWithFieldsArray,
  ): Array<string> {
    const queries: Array<string> = [];

    // The `name` and the `idPrefix` are generated in the compiler thus they are
    // not always present. So if the defined model has no name or idPrefix we skip
    // the model.
    if (definedModel.idPrefix && definedModel.idPrefix !== existingModel.idPrefix) {
      // If the prefix changes we need to recreate the model.
      // All records inserted will use the new prefix. All old IDs are not updated.
      queries.push(
        ...createTempModelQuery(
          // Create a temporary model with the new `idPrefix` but keep the existing fields.
          // We later on drop, add or modify the fields.
          convertModelToObjectFields({ ...definedModel, fields: existingModel.fields }),
          {
            name: existingModel.name,
            pluralName: existingModel.pluralName,
          },
        ),
      );
    } else if (definedModel.name && definedModel.name !== existingModel.name) {
      queries.push(
        `alter.model("${definedModel.slug}").to({name: "${definedModel.name}"})`,
      );
    }

    return queries;
  }

  /**
   * Generates queries to adjust metadata like `name` and `idPrefix` for multiple models.
   *
   * @param definedModels - The models defined locally.
   * @param existingModels - The models currently defined in the database.
   *
   * @returns An array of model metadata adjustment queries as code strings.
   */
  adjustModelsMeta(
    definedModels: Array<ModelWithFieldsArray>,
    existingModels: Array<ModelWithFieldsArray>,
  ): Array<string> {
    const databaseModelsMap = new Map(existingModels.map((s) => [s.slug, s]));
    const queries: Array<string> = [];

    for (const model of definedModels) {
      const currentModel = databaseModelsMap.get(model.slug);

      if (currentModel) {
        queries.push(...this.adjustModelMeta(model, currentModel));
      }
    }

    return queries;
  }

  /**
   * Generates queries to recreate triggers for models.
   *
   * @param definedModels - The models defined locally.
   * @param existingModels - The models currently defined in the database.
   *
   * @returns An array of trigger recreation queries as code strings.
   */
  triggersToRecreate(
    definedModels: Array<ModelWithFieldsArray>,
    existingModels: Array<ModelWithFieldsArray>,
  ): Array<string> {
    const queries: Array<string> = [];

    for (const definedModel of definedModels) {
      const existingModel = existingModels.find((m) => m.slug === definedModel.slug);
      const modelRecreated = this.modelWillBeRecreated(
        definedModel,
        existingModel || ({} as ModelWithFieldsArray),
      );

      // For each trigger in the defined model, check if a trigger with the same slug exists
      // in the database. If it does and its properties differ, drop the existing trigger and
      // create a new one with the updated properties.
      const needRecreation = Object.entries(definedModel.triggers || {}).reduce<
        Array<string>
      >((acc, [slug, trigger]) => {
        const existingTrigger = existingModel?.triggers?.[slug];
        if (
          existingTrigger &&
          !(JSON.stringify(trigger) === JSON.stringify(existingTrigger))
        ) {
          const createTrigger = createTriggerQuery(definedModel.slug, {
            slug,
            ...trigger,
          });
          const dropTrigger = dropTriggerQuery(definedModel.slug, slug);
          acc.push(dropTrigger);
          acc.push(createTrigger);
          return acc;
        }
        if (definedModel.triggers?.[slug] && !existingModel?.triggers?.[slug]) {
          acc.push(
            createTriggerQuery(definedModel.slug, {
              slug,
              ...trigger,
            }),
          );
        }
        return acc;
      }, []);

      queries.push(...(modelRecreated ? [] : needRecreation));
    }

    return queries;
  }

  /**
   * Checks if a model needs to be recreated due to field changes.
   *
   * @param definedModel - The model defined locally.
   * @param existingModel - The model currently defined in the database.
   *
   * @returns True if the model needs recreation, false otherwise.
   */
  modelWillBeRecreated(
    definedModel: ModelWithFieldsArray,
    existingModel: ModelWithFieldsArray,
  ): boolean {
    if (!existingModel) return false;
    return (
      (
        new CompareModels(definedModel, existingModel, {
          ...this.options,
          name: existingModel.name,
          pluralName: existingModel.pluralName,
        }).fieldsToAdjust(definedModel.fields || [], existingModel.fields || []) ?? []
      ).length > 0
    );
  }

  /**
   * Generates queries to recreate indexes for models.
   *
   * @param definedModels - The models defined locally.
   * @param existingModels - The models currently defined in the database.
   *
   * @returns An array of index recreation queries as code strings.
   */
  indexesToRecreate(
    definedModels: Array<ModelWithFieldsArray>,
    existingModels: Array<ModelWithFieldsArray>,
  ): Array<string> {
    const queries: Array<string> = [];

    for (const definedModel of definedModels) {
      const existingModel = existingModels.find((m) => m.slug === definedModel.slug);
      const modelRecreated = this.modelWillBeRecreated(
        definedModel,
        existingModel || ({} as ModelWithFieldsArray),
      );

      // For each index in the defined model, check if an index with the same slug exists
      // in the database. If it does and its properties differ, drop the existing index and
      // create a new one with the updated properties.
      const needRecreation = Object.entries(definedModel.indexes || {}).reduce<
        Array<string>
      >((acc, [slug, index]) => {
        const existingIndex = existingModel?.indexes?.[slug];
        if (existingIndex && !(JSON.stringify(index) === JSON.stringify(existingIndex))) {
          const createIndex = createIndexQuery(definedModel.slug, {
            slug,
            ...index,
          });
          const dropIndex = dropIndexQuery(definedModel.slug, slug);
          acc.push(dropIndex);
          acc.push(createIndex);
          return acc;
        }
        if (definedModel.indexes?.[slug] && !existingModel?.indexes?.[slug]) {
          acc.push(
            createIndexQuery(definedModel.slug, {
              slug,
              ...index,
            }),
          );
        }
        return acc;
      }, []);

      queries.push(...(modelRecreated ? [] : needRecreation));
    }

    return queries;
  }
}
