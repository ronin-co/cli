import { describe, expect, test } from 'bun:test';
import {
  Account,
  AccountNew,
  Profile,
  TestA,
  TestB,
  TestC,
  TestD,
  TestE,
  TestF,
  TestG,
  TestH,
  TestI,
  TestJ,
  TestK,
  TestL,
  TestM,
  TestN,
  TestO,
  TestP,
  TestQ,
  TestR,
  TestS,
  TestT,
} from '@/fixtures/index';
import { getSQLTables, runMigration } from '@/fixtures/utils';

describe('apply', () => {
  describe('model', () => {
    test('create a model', async () => {
      const { models, statements } = await runMigration([TestA], []);

      expect(statements).toHaveLength(4);
      expect(models).toHaveLength(1);
      expect(models[0].slug).toBe('test');
    });

    test('drop a model', async () => {
      const { models, statements } = await runMigration([], [TestA]);

      expect(statements).toHaveLength(2);
      expect(models).toHaveLength(0);
    });

    test('update a model', async () => {
      const { models, statements } = await runMigration([TestF], [TestA]);

      expect(statements).toHaveLength(7);
      expect(models).toHaveLength(1);
      expect(models[0].slug).toBe('test');
    });

    test('update model meta properties', async () => {
      const { models } = await runMigration([TestC], [TestA]);

      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('ThisIsACoolModel');
    });

    test('drop multiple models with dependencies', async () => {
      const { models } = await runMigration([], [Account, Profile, TestA]);

      expect(models).toHaveLength(0);
    });

    test('migrate with no changes between model sets', async () => {
      const allModels = [TestG, Account, AccountNew, Profile];
      const { models } = await runMigration(allModels, allModels);

      expect(models.length).toBe(allModels.length);
    });
  });
  describe('field', () => {
    test('add field and change field property', async () => {
      const { models } = await runMigration([TestG], [TestF]);

      expect(models).toHaveLength(1);
    });

    test('change field type', async () => {
      const { models } = await runMigration([TestM], [TestL]);

      expect(models).toHaveLength(1);
      // @ts-expect-error This is defined!
      expect(models[0]?.fields[1]?.type).toBe('json');
    });

    test('adding a unique field', async () => {
      const { models } = await runMigration([TestG], [TestN]);

      expect(models).toHaveLength(1);
      // @ts-expect-error This is defined!
      expect(models[0]?.fields[0]?.unique).toBe(true);
    });

    test('removing a unique field', async () => {
      const { models } = await runMigration([TestN], [TestG]);

      expect(models).toHaveLength(1);
      // @ts-expect-error This is defined!
      expect(models[0]?.fields[0]?.type).toBe('string');
    });

    test('removing field and adding new fields', async () => {
      const { models, modelDiff } = await runMigration([TestP], [TestO]);

      expect(modelDiff).toHaveLength(4);
      expect(models).toHaveLength(1);
      // @ts-expect-error This is defined!
      expect(models[0]?.fields[0]?.type).toBe('string');
      // @ts-expect-error This is defined!
      expect(models[0]?.fields[1]?.type).toBe('string');
      // @ts-expect-error This is defined!
      expect(models[0]?.fields[3]?.unique).toBe(true);
    });
  });
  describe('rename', () => {
    test('update a model - rename', async () => {
      const { models, statements } = await runMigration([Account], [AccountNew], true);

      expect(statements).toHaveLength(2);
      expect(models).toHaveLength(1);
      expect(models[0].slug).toBe('account');
    });

    test('rename model with existing relationships', async () => {
      const { models } = await runMigration(
        [AccountNew, Profile],
        [Account, Profile],
        true,
      );

      expect(models.find((m) => m.slug === 'account_new')).toBeDefined();
    });

    test('create model with field rename', async () => {
      const { models } = await runMigration([TestI], [TestH], true);

      expect(models).toHaveLength(1);
    });
  });
  describe('index', () => {
    test('create a model with index', async () => {
      const { models, statements } = await runMigration([TestB], []);

      expect(statements).toHaveLength(4);
      expect(models).toHaveLength(1);
      expect(models[0].slug).toBe('test');
    });

    test('drop model with index', async () => {
      const { models, statements } = await runMigration([], [TestB]);

      expect(statements).toHaveLength(2);
      expect(models).toHaveLength(0);
    });
  });
  describe('trigger', () => {
    test('create model with triggers', async () => {
      const { models } = await runMigration([TestC, TestD], []);

      expect(models).toHaveLength(2);
      expect(models[0].triggers).toBeDefined();
    });

    test('update model triggers', async () => {
      const { models } = await runMigration([TestE, TestC], [TestD]);

      expect(models).toHaveLength(2);
      expect(models[0]?.triggers?.[0]?.action).toBe('DELETE');
    });

    test('complex model transformation with indexes and triggers', async () => {
      const { models } = await runMigration([TestE, TestB], [TestD, TestA]);

      expect(models).toHaveLength(2);
    });
    test('change trigger', async () => {
      const { models } = await runMigration([TestE], [TestD]);

      expect(models).toHaveLength(1);
      expect(models[0]?.triggers?.[0]?.action).toBe('DELETE');
      expect(models[0]?.triggers?.[0]?.when).toBe('AFTER');
    });
  });
  describe('relationship', () => {
    test('create multiple models with relationships', async () => {
      const { models, statements } = await runMigration([Account, Profile], []);

      expect(statements.length).toEqual(4);
      expect(models).toHaveLength(2);
    });
    test('create model with link cascade', async () => {
      const { models } = await runMigration([TestE, TestK], [TestE, TestJ]);

      expect(models).toHaveLength(2);
      // @ts-expect-error This is defined!
      expect(models[1]?.fields[0]?.actions?.onDelete).toBe('CASCADE');
    });

    test('create model with many-to-many relationship', async () => {
      const { models, db } = await runMigration([TestP, TestQ], []);

      const res = await getSQLTables(db);

      expect(res).toHaveLength(4);
      expect(models).toHaveLength(2);
    });

    test('update model with many-to-many relationship', async () => {
      const { models, db } = await runMigration([TestP, TestR], [TestP, TestQ]);

      const res = await getSQLTables(db);

      expect(res).toHaveLength(5);
      expect(models).toHaveLength(2);
    });

    test('add field to model with many-to-many relationship', async () => {
      const { models, db } = await runMigration([TestP, TestS], [TestP, TestQ]);

      const res = await getSQLTables(db);

      expect(res).toHaveLength(5);
      expect(models).toHaveLength(2);
    });

    test('remove many-to-many relationship', async () => {
      const { models, db } = await runMigration([TestP, TestT], [TestP, TestQ]);

      const res = await getSQLTables(db);

      expect(res).toHaveLength(3);
      expect(models).toHaveLength(2);
    });
  });

  describe('complex', () => {
    test('complex model update with multiple changes', async () => {
      const { models } = await runMigration(
        [TestE, TestB, Account],
        [TestD, TestA, AccountNew],
        true,
      );

      expect(models).toHaveLength(3);
    });

    test('create and update models with mixed operations', async () => {
      const { models } = await runMigration([TestB, TestE, Account], [TestA, TestD]);

      expect(models.length).toBeGreaterThan(1);
    });
  });
  describe('error', () => {});
});
