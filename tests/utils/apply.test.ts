import { describe, expect, test } from 'bun:test';
import {
  Account,
  Account3,
  AccountNew,
  AccountWithBoolean,
  AccountWithRequiredBoolean,
  AccountWithRequiredDefault,
  AccountWithoutUnique,
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
  TestT,
  TestU,
} from '@/fixtures/index';
import { getRowCount, getSQLTables, getTableRows, runMigration } from '@/fixtures/utils';
import { getLocalPackages } from '@/src/utils/misc';
import type { Model } from '@ronin/syntax/schema';
import { model, string } from 'ronin/schema';
const packages = await getLocalPackages();
const { Transaction } = packages.compiler;

describe('apply', () => {
  describe('model', () => {
    describe('without records', () => {
      describe('create', () => {
        test('simple', async () => {
          const { models, statements, db } = await runMigration([TestA], []);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }

          expect(statements).toHaveLength(4);
          expect(models).toHaveLength(1);
          expect(models[0].slug).toBe('test');
          expect(rowCounts).toEqual({
            tests: 0,
          });
        });

        test('with index', async () => {
          const { models, statements, db } = await runMigration([TestB], []);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(statements).toHaveLength(4);
          expect(models).toHaveLength(1);
          expect(models[0].slug).toBe('test');
          expect(rowCounts).toEqual({
            tests: 0,
          });
        });

        test('with triggers', async () => {
          const { models, db } = await runMigration([TestC, TestD], []);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(2);
          expect(models[0].triggers).toBeDefined();
          expect(rowCounts).toEqual({
            tests: 0,
            comments: 0,
          });
        });

        test('with relationships', async () => {
          const { models, statements, db } = await runMigration([Account, Profile], []);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(statements.length).toEqual(4);
          expect(models).toHaveLength(2);
          expect(rowCounts).toEqual({
            accounts: 0,
            profiles: 0,
          });
        });

        test('with one-to-many relationship', async () => {
          const { models, db } = await runMigration([TestP, TestQ], []);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          const res = await getSQLTables(db);

          expect(res).toHaveLength(4);
          expect(models).toHaveLength(2);
          expect(rowCounts).toEqual({
            manies: 0,
            tests: 0,
          });
        });
      });

      describe('drop', () => {
        test('simple', async () => {
          const { models, statements, db } = await runMigration([], [TestA]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(statements).toHaveLength(2);
          expect(models).toHaveLength(0);
          expect(rowCounts).toEqual({});
        });

        test('multiple with dependencies', async () => {
          const { models, db } = await runMigration([], [Account, Profile, TestA]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(0);
          expect(rowCounts).toEqual({});
        });

        test('with index', async () => {
          const { models, statements, db } = await runMigration([], [TestB]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(statements).toHaveLength(2);
          expect(models).toHaveLength(0);
          expect(rowCounts).toEqual({});
        });
      });

      describe('update', () => {
        test('fields', async () => {
          const { models, statements, db } = await runMigration([TestF], [TestA]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(statements).toHaveLength(7);
          expect(models).toHaveLength(1);
          expect(models[0].slug).toBe('test');
          expect(rowCounts).toEqual({
            tests: 0,
          });
        });

        test('meta properties', async () => {
          const { models, db } = await runMigration([TestC], [TestA]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }

          expect(models).toHaveLength(1);
          expect(models[0].name).toBe('ThisIsACoolModel');
          expect(rowCounts).toEqual({
            tests: 0,
          });
        });

        test('no changes between model sets', async () => {
          const allModels = [TestG, Account, AccountNew, Profile];
          const { models, db } = await runMigration(allModels, allModels);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models.length).toBe(allModels.length);
          expect(rowCounts).toEqual({
            tests: 0,
            accounts: 0,
            accounts_new: 0,
            profiles: 0,
          });
        });
      });
    });

    describe('with records', () => {
      describe('create', () => {
        test('simple', async () => {
          const { models, db } = await runMigration([TestA], []);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(1);
          expect(rowCounts).toEqual({
            tests: 0,
          });
        });
      });

      describe('update', () => {
        test('id prefix', async () => {
          const definedModel = model({
            slug: 'test',
            idPrefix: 'test',
            fields: {
              name: string(),
            },
          }) as unknown as Model;

          const existingModel = model({
            slug: 'test',
            idPrefix: 'corny',
            fields: {
              name: string(),
            },
          }) as unknown as Model;

          const insert = {
            add: {
              test: {
                with: {
                  name: 'Ilayda',
                },
              },
            },
          };

          const transaction = new Transaction([insert], {
            // @ts-expect-error This works once the types are fixed.
            models: [definedModel, existingModel],
            inlineParams: true,
          });

          const { db, models } = await runMigration(
            // @ts-expect-error This works once the types are fixed.
            [definedModel],
            [existingModel],
            {},
            transaction.statements.map((statement) => statement),
          );

          await db.query(transaction.statements);
          const rows = await getTableRows(db, models[0]);

          expect(models[0].slug).toBe('test');
          expect(rows[0].id).toContain('corny_');
          expect(rows[1].id).toContain('test_');
        });
      });
    });
  });

  describe('field', () => {
    describe('without records', () => {
      describe('create', () => {
        test('add field and change property', async () => {
          const { models, db } = await runMigration([TestG], [TestF]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(1);
          expect(rowCounts).toEqual({
            tests: 0,
          });
        });

        test('add unique field', async () => {
          const { models, db } = await runMigration([TestG], [TestN], {
            requiredDefault: 'RONIN_TEST_VALUE',
          });

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }

          expect(models).toHaveLength(1);
          // @ts-expect-error This is defined!
          expect(models[0]?.fields[0]?.unique).toBe(true);
          expect(rowCounts).toEqual({
            tests: 0,
          });
        });
      });

      describe('drop', () => {
        test('remove unique field', async () => {
          const { models, db } = await runMigration([TestN], [TestG]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(1);
          // @ts-expect-error This is defined!
          expect(models[0]?.fields[0]?.type).toBe('string');
          expect(rowCounts).toEqual({
            tests: 0,
          });
        });

        test('remove field and add new fields', async () => {
          const { models, modelDiff, db } = await runMigration([TestP], [TestO]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(modelDiff).toHaveLength(4);
          expect(models).toHaveLength(1);
          // @ts-expect-error This is defined!
          expect(models[0]?.fields[0]?.type).toBe('string');
          // @ts-expect-error This is defined!
          expect(models[0]?.fields[1]?.type).toBe('string');
          // @ts-expect-error This is defined!
          expect(models[0]?.fields[3]?.unique).toBe(true);
          expect(rowCounts).toEqual({
            tests: 0,
          });
        });
      });

      describe('update', () => {
        test('type', async () => {
          const { models, db } = await runMigration([TestM], [TestL]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(1);
          // @ts-expect-error This is defined!
          expect(models[0]?.fields[1]?.type).toBe('json');
          expect(rowCounts).toEqual({
            tests: 0,
          });
        });

        test('rename', async () => {
          const { models, db } = await runMigration([TestI], [TestH], {
            rename: true,
            requiredDefault: 'RONIN_TEST_VALUE',
          });

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(1);
          expect(rowCounts).toEqual({
            tests: 0,
          });
        });
      });
    });

    describe('with records', () => {
      describe('create', () => {
        test('required field & unqiue', async () => {
          const insert = {
            add: {
              account: {
                with: {
                  name: 'Jacqueline',
                },
              },
            },
          };

          const transaction = new Transaction([insert], {
            models: [Account, Account3],
            inlineParams: true,
          });

          const { models, db } = await runMigration(
            [Account3],
            [Account],
            { rename: false, requiredDefault: 'RONIN_TEST_VALUE' },
            transaction.statements.map((statement) => statement),
          );

          const rows = await getTableRows(db, Account3);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(rowCounts).toEqual({
            accounts: 1,
          });

          expect(rows[0].email).toBe('RONIN_TEST_VALUE');
        });

        test('required field', async () => {
          const insert = {
            add: {
              account: {
                with: {
                  name: 'Jacqueline',
                },
              },
            },
          };

          const transaction = new Transaction([insert], {
            models: [Account, AccountWithoutUnique],
            inlineParams: true,
          });

          const { models, db } = await runMigration(
            [AccountWithoutUnique],
            [Account],
            { rename: false, requiredDefault: 'RONIN_TEST_VALUE' },
            transaction.statements.map((statement) => statement),
          );

          const rows = await getTableRows(db, Account3);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(rowCounts).toEqual({
            accounts: 1,
          });
          expect(rows[0].email).toBe('RONIN_TEST_VALUE');
        });

        test('required field with default value', async () => {
          const insert = {
            add: {
              account: {
                with: {
                  name: 'Jacqueline',
                },
              },
            },
          };

          const transaction = new Transaction([insert], {
            models: [Account, AccountWithRequiredDefault],
            inlineParams: true,
          });

          const { models, db } = await runMigration(
            [AccountWithRequiredDefault],
            [Account],
            { rename: false, requiredDefault: 'RONIN_TEST_VALUE' },
            transaction.statements.map((statement) => statement),
          );

          const rows = await getTableRows(db, Account3);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(rowCounts).toEqual({
            accounts: 1,
          });
          expect(rows[0].email).toBe('RONIN_TEST_VALUE_REQUIRED_DEFAULT');
        });

        test('required field with number', async () => {
          const insert = {
            add: {
              account: {
                with: {
                  name: 'Jacqueline',
                },
              },
            },
          };

          const transaction = new Transaction([insert], {
            models: [AccountWithBoolean, AccountWithRequiredBoolean],
            inlineParams: true,
          });

          const { models, db } = await runMigration(
            [AccountWithRequiredBoolean],
            [AccountWithBoolean],
            { rename: false, requiredDefault: true },
            transaction.statements.map((statement) => statement),
          );

          const rows = await getTableRows(db, Account3);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(rowCounts).toEqual({
            accounts: 1,
          });

          // @ts-expect-error This is defined!
          expect(rows[0].email).toBe(1);
        });
      });

      describe('update', () => {
        test('required field', async () => {
          const insert = {
            add: {
              test: {
                with: {
                  test: 'test',
                },
              },
            },
          };

          const transaction = new Transaction([insert], {
            models: [TestL, TestU],
            inlineParams: true,
          });

          const { models, db } = await runMigration(
            [TestU],
            [TestL],
            { rename: false, requiredDefault: 'RONIN_TEST_VALUE' },
            transaction.statements.map((statement) => statement),
          );

          const rows = await getTableRows(db, TestU);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(rowCounts).toEqual({
            tests: 1,
          });

          expect(rows[0].name).toBe('RONIN_TEST_VALUE');
        });
      });
    });
  });

  describe('relationship', () => {
    describe('without records', () => {
      describe('create', () => {
        test('with link cascade', async () => {
          const { models, db } = await runMigration([TestE, TestK], [TestE, TestJ]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(2);
          // @ts-expect-error This is fixed when we stop converting between arrays and objects.
          expect(models[1]?.fields[0]?.actions?.onDelete).toBe('CASCADE');
          expect(rowCounts).toEqual({
            comments: 0,
            tests: 0,
          });
        });

        test('one-to-many', async () => {
          const { models, db } = await runMigration([TestP, TestR], [TestP, TestQ]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          const res = await getSQLTables(db);

          expect(res).toHaveLength(5);
          expect(models).toHaveLength(2);
          expect(rowCounts).toEqual({
            tests: 0,
            manies: 0,
          });
        });
      });

      describe('drop', () => {
        test('many-to-many', async () => {
          const { models, db } = await runMigration([TestP, TestT], [TestP, TestQ]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          const res = await getSQLTables(db);

          expect(res).toHaveLength(3);
          expect(models).toHaveLength(2);
          expect(rowCounts).toEqual({
            manies: 0,
            tests: 0,
          });
        });
      });

      describe('update', () => {
        test('model name', async () => {
          const { models, statements, db } = await runMigration([Account], [AccountNew], {
            rename: true,
            requiredDefault: 'RONIN_TEST_VALUE',
          });

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(statements).toHaveLength(2);
          expect(models).toHaveLength(1);
          expect(models[0].slug).toBe('account');
          expect(rowCounts).toEqual({
            accounts: 0,
          });
        });

        test('with existing relationships', async () => {
          const { models, db } = await runMigration(
            [AccountNew, Profile],
            [Account, Profile],
            { rename: true, requiredDefault: 'RONIN_TEST_VALUE' },
          );

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models.find((m) => m.slug === 'account_new')).toBeDefined();
          expect(rowCounts).toEqual({
            account_news: 0,
            profiles: 0,
          });
        });
      });
    });
  });

  describe('trigger', () => {
    describe('without records', () => {
      describe('create', () => {
        test('with model', async () => {
          const { models, db } = await runMigration([TestC, TestD], []);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(2);
          expect(models[0].triggers).toBeDefined();
          expect(rowCounts).toEqual({
            tests: 0,
            comments: 0,
          });
        });
      });

      describe('update', () => {
        test('action', async () => {
          const { models, db } = await runMigration([TestE], [TestD]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(1);
          expect(models[0]?.triggers?.filedTrigger?.action).toBe('DELETE');
          expect(models[0]?.triggers?.filedTrigger?.when).toBe('AFTER');
          expect(rowCounts).toEqual({
            comments: 0,
          });
        });
      });
    });
  });

  describe('index', () => {
    describe('without records', () => {
      describe('create', () => {
        test('simple', async () => {
          const { models, db } = await runMigration([TestB], []);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(1);
          expect(rowCounts).toEqual({
            tests: 0,
          });
        });
      });

      describe('drop', () => {
        test('simple', async () => {
          const { models, db } = await runMigration([], [TestA]);

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(0);
        });
      });
    });
  });

  describe('complex', () => {
    describe('without records', () => {
      describe('update', () => {
        test('multiple changes', async () => {
          const { models, db } = await runMigration(
            [TestE, TestB, Account],
            [TestD, TestA, AccountNew],
            { rename: true, requiredDefault: 'RONIN_TEST_VALUE' },
          );

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models).toHaveLength(3);
          expect(rowCounts).toEqual({
            tests: 0,
            comments: 0,
            accounts: 0,
          });
        });

        test('mixed operations', async () => {
          const { models, db } = await runMigration(
            [TestB, TestE, Account],
            [TestA, TestD],
            { rename: true, requiredDefault: 'RONIN_TEST_VALUE' },
          );

          const rowCounts: Record<string, number> = {};
          for (const model of models) {
            if (model.pluralSlug) {
              rowCounts[model.pluralSlug] = await getRowCount(db, model.pluralSlug);
            }
          }
          expect(models.length).toBeGreaterThan(1);
          expect(rowCounts).toEqual({
            tests: 0,
            comments: 0,
            accounts: 0,
          });
        });
      });
    });
  });
});
