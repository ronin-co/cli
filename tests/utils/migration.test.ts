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

        expect(modelDiff).toHaveLength(1);
        expect(modelDiff).toStrictEqual([
          'create.model({"slug":"comment","fields":{"name":{"type":"string"}},"triggers":{"filedTrigger":{"action":"INSERT","when":"BEFORE","effects":[{"__RONIN_QUERY":{"add":{"comment":{"with":{"name":"Test"}}}}}]}}})',
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
});
