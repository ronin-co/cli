import { describe, expect, test } from 'bun:test';
import {
  Account,
  Account2,
  AccountNew,
  Profile,
  TestA,
  TestB,
  TestC,
  TestD,
  TestE,
} from '@/fixtures/index';
import { Migration } from '@/src/utils/migration';
import type { Model } from '@ronin/compiler';

describe('migration', () => {
  describe('diff models', () => {
    test('returns empty array when models are in sync', async () => {
      const modelDiff = await new Migration([], [TestB]).diff();

      expect(modelDiff).toHaveLength(1);
      expect(modelDiff).toStrictEqual(['drop.model("test")']);
    });

    test('returns empty array when both code and db have same account model', async () => {
      // It is not recognized as a model.
      const modelDiff = await new Migration([Account], [Account]).diff();

      expect(modelDiff).toHaveLength(0);
      expect(modelDiff).toStrictEqual([]);
    });

    test('generates migration steps when renaming model slug', async () => {
      // It is not recognized as a model.
      const modelDiff = await new Migration([Account], [Account2], {
        rename: true,
      }).diff();

      expect(modelDiff).toHaveLength(4);
      expect(modelDiff).toStrictEqual([
        'create.model({"slug":"RONIN_TEMP_account","fields":{"name":{"type":"string"}}})',
        'add.RONIN_TEMP_account.with(() => get.account())',
        'drop.model("account")',
        // The names are undefined because the existing model never got run through the compiler.
        'alter.model("RONIN_TEMP_account").to({slug: "account", name: "undefined", pluralName: "undefined"})',
      ]);
    });

    test('creates new model when code has additional model', async () => {
      // It is not recognized as a model.
      const modelDiff = await new Migration([Account, Profile], [Account]).diff();
      expect(modelDiff).toHaveLength(1);
      expect(modelDiff).toStrictEqual([
        'create.model({"slug":"profile","fields":{"username":{"type":"string"}}})',
      ]);
    });

    test('drops model when db has additional model', async () => {
      // It is not recognized as a model.
      const modelDiff = await new Migration([Account], [Account, Profile]).diff();

      expect(modelDiff).toHaveLength(1);
      expect(modelDiff).toStrictEqual(['drop.model("profile")']);
    });

    test('generates migration steps when field properties change', async () => {
      // It is not recognized as a model.
      const modelDiff = await new Migration([Account2], [Account]).diff();

      expect(modelDiff).toHaveLength(4);
      expect(modelDiff).toStrictEqual([
        'create.model({"slug":"RONIN_TEMP_account","fields":{"name":{"required":true,"unique":true,"type":"string"}}})',
        'add.RONIN_TEMP_account.with(() => get.account())',
        'drop.model("account")',
        // The names are undefined because the existing model never got run through the compiler.
        'alter.model("RONIN_TEMP_account").to({slug: "account", name: "undefined", pluralName: "undefined"})',
      ]);
    });

    test('generates migration steps when meta model properties change', async () => {
      // It is not recognized as a model.
      const modelDiff = await new Migration([TestC], [TestA]).diff();

      expect(modelDiff).toHaveLength(4);
      expect(modelDiff).toStrictEqual([
        'create.model({"slug":"RONIN_TEMP_test","fields":{"age":{"required":true,"unique":true,"type":"string"},"active":{"type":"boolean"}},"name":"ThisIsACoolModel","idPrefix":"TICM"})',
        'add.RONIN_TEMP_test.with(() => get.test())',
        'drop.model("test")',
        // The names are undefined because the existing model never got run through the compiler.
        'alter.model("RONIN_TEMP_test").to({slug: "test", name: "undefined", pluralName: "undefined"})',
      ]);
    });

    test('generates migration steps when field definitions differ', async () => {
      // It is not recognized as a model.
      const modelDiff = await new Migration([Account], [Account2]).diff();

      expect(modelDiff).toHaveLength(4);
      expect(modelDiff).toStrictEqual([
        'create.model({"slug":"RONIN_TEMP_account","fields":{"name":{"type":"string"}}})',
        'add.RONIN_TEMP_account.with(() => get.account())',
        'drop.model("account")',
        // The names are undefined because the existing model never got run through the compiler.
        'alter.model("RONIN_TEMP_account").to({slug: "account", name: "undefined", pluralName: "undefined"})',
      ]);
    });

    test('renames model when model is renamed', async () => {
      const modelDiff = await new Migration([AccountNew, Profile], [Account, Profile], {
        rename: true,
      }).diff();

      expect(modelDiff).toHaveLength(1);
      expect(modelDiff).toStrictEqual([
        'alter.model("account").to({slug: "account_new"})',
      ]);
    });

    describe('indexes', () => {
      test('handles index changes', async () => {
        const modelDiff = await new Migration([TestB], [TestA]).diff();

        expect(modelDiff).toBeDefined();
        expect(modelDiff).toHaveLength(7);
      });
    });

    describe('triggers', () => {
      test('create model and trigger', async () => {
        const modelDiff = await new Migration([TestD], []).diff();

        expect(modelDiff).toBeDefined();
        expect(modelDiff).toHaveLength(2);

        expect(modelDiff).toStrictEqual([
          'create.model({"slug":"comment","fields":{"name":{"type":"string"}}})',
          'alter.model("comment").create.trigger({"slug":"filedTrigger","action":"INSERT","when":"BEFORE","effects":[{"__RONIN_QUERY":{"add":{"comment":{"with":{"name":"Test"}}}}}]})',
        ]);
      });

      test('drop model and trigger', async () => {
        const modelDiff = await new Migration([], [TestD]).diff();

        // Only drops the model because triggers are dropped by default
        expect(modelDiff).toHaveLength(1);
        expect(modelDiff).toStrictEqual(['drop.model("comment")']);
      });

      test('adjust trigger', async () => {
        const modelDiff = await new Migration([TestE], [TestD]).diff();

        expect(modelDiff).toHaveLength(2);
        expect(modelDiff).toStrictEqual([
          'alter.model("comment").drop.trigger("filedTrigger")',
          'alter.model("comment").create.trigger({"slug":"filedTrigger","action":"DELETE","when":"AFTER","effects":[{"__RONIN_QUERY":{"add":{"comment":{"with":{"name":"Test"}}}}}]})',
        ]);
      });
    });
  });

  describe('drop models', () => {
    test('generates drop queries for multiple models', () => {
      const models = [
        {
          slug: 'test1',
        },
        {
          slug: 'test2',
        },
      ];

      const queries = new Migration().dropModels(models);

      expect(queries).toHaveLength(2);
      expect(queries).toStrictEqual(['drop.model("test1")', 'drop.model("test2")']);
    });

    test('returns empty array for empty model list', () => {
      const queries = new Migration().dropModels([]);

      expect(queries).toHaveLength(0);
      expect(queries).toStrictEqual([]);
    });
  });

  describe('create models', () => {
    test('generates create queries for multiple models with fields', () => {
      const models: Array<Model> = [
        {
          slug: 'test1',
          fields: {
            field1: {
              name: 'Field1',
              type: 'string',
            },
          },
        },
        {
          slug: 'test2',
          fields: {
            field2: {
              name: 'Field2',
              type: 'number',
            },
          },
        },
      ];

      const queries = new Migration().createModels(models);

      expect(queries).toHaveLength(2);
      expect(queries).toStrictEqual([
        'create.model({"slug":"test1","fields":{"field1":{"name":"Field1","type":"string"}}})',
        'create.model({"slug":"test2","fields":{"field2":{"name":"Field2","type":"number"}}})',
      ]);
    });

    test('handles model with no fields', () => {
      const models = [
        {
          slug: 'test1',
        },
      ];

      const queries = new Migration().createModels(models);

      expect(queries).toHaveLength(1);
      expect(queries).toStrictEqual(['create.model({"slug":"test1"})']);
    });

    test('returns empty array for empty model list', () => {
      const queries = new Migration().createModels([]);

      expect(queries).toHaveLength(0);
      expect(queries).toStrictEqual([]);
    });
  });

  describe('dropAndAddIndexes', () => {
    test('adds new indexes and drops removed ones', () => {
      const definedModel = {
        slug: 'test',
        indexes: {
          index_1: {
            fields: [{ slug: 'field1' }],
            unique: true,
          },
        },
      } as unknown as Model;

      const existingModel = {
        slug: 'test',
        indexes: {
          index_1: {
            fields: [{ slug: 'field2' }],
            unique: false,
            slug: 'old_index',
          },
        },
      } as unknown as Model;

      const queries = [
        ...new Migration().indexesToRecreate([definedModel], [existingModel]),
      ];

      expect(queries).toHaveLength(2);
      expect(queries).toStrictEqual([
        'alter.model("test").drop.index("index_1")',
        'alter.model("test").create.index({"slug":"index_1","fields":[{"slug":"field1"}],"unique":true})',
      ]);
    });
  });

  describe('indexesToRecreate', () => {
    test('returns empty array when no models provided', () => {
      const queries = new Migration().indexesToRecreate([], []);
      expect(queries).toHaveLength(0);
      expect(queries).toStrictEqual([]);
    });

    test('returns queries for all models that need index changes', () => {
      const definedModels = [
        {
          slug: 'test1',
          indexes: {
            index_1: {
              fields: [{ slug: 'field1' }],
              unique: true,
            },
          },
        },
        {
          slug: 'test2',
          indexes: {
            index2: {
              fields: [{ slug: 'field2' }],
              unique: false,
            },
          },
        },
      ] as unknown as Array<Model>;

      const existingModels = [
        {
          slug: 'test1',
          indexes: {
            index_1: {
              fields: [{ slug: 'field1' }],
              unique: false,
              slug: 'old_index1',
            },
          },
        },
        {
          slug: 'test2',
          indexes: {
            index2: {
              fields: [{ slug: 'different' }],
              unique: false,
              slug: 'old_index2',
            },
          },
        },
      ] as unknown as Array<Model>;

      const queries = new Migration().indexesToRecreate(definedModels, existingModels);

      expect(queries).toHaveLength(4);
      expect(queries).toStrictEqual([
        'alter.model("test1").drop.index("index_1")',
        'alter.model("test1").create.index({"slug":"index_1","fields":[{"slug":"field1"}],"unique":true})',
        'alter.model("test2").drop.index("index2")',
        'alter.model("test2").create.index({"slug":"index2","fields":[{"slug":"field2"}],"unique":false})',
      ]);
    });

    test('handles non-existing models', () => {
      const definedModels = [
        {
          slug: 'test1',
          indexes: {
            fieldIndex: {
              fields: [{ slug: 'field1' }],
              unique: true,
            },
          },
        },
      ] as unknown as Array<Model>;

      const existingModels: Array<Model> = [];

      const queries = new Migration().indexesToRecreate(definedModels, existingModels);

      expect(queries).toHaveLength(1);
      expect(queries).toStrictEqual([
        'alter.model("test1").create.index({"slug":"fieldIndex","fields":[{"slug":"field1"}],"unique":true})',
      ]);
    });
  });

  describe('adjustModelMeta', () => {
    test('generates alter queries when model meta properties change', () => {
      const definedModels = [
        {
          slug: 'test1',
          name: 'Test Model 1',
          idPrefix: 'TM1',
        },
        {
          slug: 'test2',
          name: 'Test Model 2',
          idPrefix: 'TM2',
        },
      ];

      const existingModels = [
        {
          slug: 'test1',
          name: 'Old Name 1',
          pluralName: 'Old Plural Name 1',
          idPrefix: 'OLD1',
        },
        {
          slug: 'test2',
          name: 'Test Model 2', // Same name
          pluralName: 'Old Plural Name 2',
          idPrefix: 'OLD2',
        },
      ];

      const queries = new Migration().adjustModelsMeta(definedModels, existingModels);

      expect(queries).toHaveLength(8);
      expect(queries).toStrictEqual([
        'create.model({"slug":"RONIN_TEMP_test1","fields":{},"name":"Test Model 1","idPrefix":"TM1"})',
        'add.RONIN_TEMP_test1.with(() => get.test1())',
        'drop.model("test1")',
        'alter.model("RONIN_TEMP_test1").to({slug: "test1", name: "Old Name 1", pluralName: "Old Plural Name 1"})',
        'create.model({"slug":"RONIN_TEMP_test2","fields":{},"name":"Test Model 2","idPrefix":"TM2"})',
        'add.RONIN_TEMP_test2.with(() => get.test2())',
        'drop.model("test2")',
        'alter.model("RONIN_TEMP_test2").to({slug: "test2", name: "Test Model 2", pluralName: "Old Plural Name 2"})',
      ]);
    });

    test('skips models without name and idPrefix', () => {
      // This is not possible! The CLI can't detect that we removed the idPrefix. Because
      // the idPrefix is autogenerated by the compiler.
      const definedModels = [
        {
          slug: 'test1',
          name: 'Test Model 1',
          // Missing idPrefix.
        },
        {
          slug: 'test2',
          // Missing both name and idPrefix.
        },
      ];

      const existingModels = [
        {
          slug: 'test1',
          name: 'Old Name',
          idPrefix: 'OLD',
        },
      ];

      const queries = new Migration().adjustModelsMeta(definedModels, existingModels);

      expect(queries).toHaveLength(1);
      expect(queries).toStrictEqual(['alter.model("test1").to({name: "Test Model 1"})']);
    });

    test('returns empty array when no changes needed', () => {
      const definedModels = [
        {
          slug: 'test1',
          name: 'Test Model',
          idPrefix: 'TM',
        },
      ];

      const existingModels = [
        {
          slug: 'test1',
          name: 'Test Model',
          idPrefix: 'TM',
        },
      ];

      const queries = new Migration().adjustModelsMeta(definedModels, existingModels);

      expect(queries).toHaveLength(0);
      expect(queries).toStrictEqual([]);
    });
  });

  describe('triggersToRecreate', () => {
    test('returns empty array when no models provided', () => {
      const queries = new Migration().triggersToRecreate([], []);
      expect(queries).toHaveLength(0);
      expect(queries).toStrictEqual([]);
    });

    test('returns queries for all models that need trigger changes', () => {
      const definedModels: Array<Model> = [
        {
          slug: 'test1',
          triggers: {
            trigger1: {
              fields: [{ slug: 'field1' }],
              action: 'INSERT',
              when: 'BEFORE',
              effects: [],
            },
          },
        },
        {
          slug: 'test2',
          triggers: {
            trigger2: {
              fields: [{ slug: 'field2' }],
              action: 'DELETE',
              when: 'AFTER',
              effects: [],
            },
          },
        },
      ];

      const existingModels: Array<Model> = [
        {
          slug: 'test1',
          triggers: {
            trigger1: {
              fields: [{ slug: 'field1' }],
              action: 'UPDATE',
              when: 'AFTER',
              effects: [],
            },
          },
        },
        {
          slug: 'test2',
          triggers: {
            trigger2: {
              fields: [{ slug: 'field3' }],
              action: 'INSERT',
              when: 'BEFORE',
              effects: [],
            },
          },
        },
      ];

      const queries = new Migration().triggersToRecreate(definedModels, existingModels);

      expect(queries).toHaveLength(4);
      expect(queries).toStrictEqual([
        'alter.model("test1").drop.trigger("trigger1")',
        'alter.model("test1").create.trigger({"slug":"trigger1","fields":[{"slug":"field1"}],"action":"INSERT","when":"BEFORE","effects":[]})',
        'alter.model("test2").drop.trigger("trigger2")',
        'alter.model("test2").create.trigger({"slug":"trigger2","fields":[{"slug":"field2"}],"action":"DELETE","when":"AFTER","effects":[]})',
      ]);
    });

    test('handles models with no triggers', () => {
      const definedModels: Array<Model> = [
        {
          slug: 'test1',
        },
      ];

      const existingModels: Array<Model> = [
        {
          slug: 'test1',
        },
      ];

      const queries = new Migration().triggersToRecreate(definedModels, existingModels);

      expect(queries).toHaveLength(0);
      expect(queries).toStrictEqual([]);
    });

    test('handles when existing model is not found', () => {
      const definedModels: Array<Model> = [
        {
          slug: 'test1',
          triggers: {
            filedTrigger: {
              fields: [{ slug: 'field1' }],
              action: 'INSERT',
              when: 'BEFORE',
              effects: [],
            },
          },
        },
      ];

      const existingModels: Array<Model> = [];

      const queries = new Migration().triggersToRecreate(definedModels, existingModels);

      expect(queries).toHaveLength(1);
      expect(queries).toStrictEqual([
        'alter.model("test1").create.trigger({"slug":"filedTrigger","fields":[{"slug":"field1"}],"action":"INSERT","when":"BEFORE","effects":[]})',
      ]);
    });
  });
});
