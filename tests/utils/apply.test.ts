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
} from '@/fixtures/index';

import { describe, expect, test } from 'bun:test';
import { queryEphemeralDatabase } from '@/fixtures/utils';
import { diffModels } from '@/src/utils/migration';
import { getLocalPackages } from '@/src/utils/misc';
import { getModels } from '@/src/utils/model';
import { Protocol } from '@/src/utils/protocol';
import type { Model } from '@ronin/compiler';

describe('apply', () => {
  test('create a model', async () => {
    const definedModels: Array<Model> = [TestA];
    const existingModels: Array<Model> = [];

    const modelDiff = await diffModels(definedModels, existingModels);
    const packages = await getLocalPackages();
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);
    expect(statements).toHaveLength(4);

    const db = await queryEphemeralDatabase(existingModels);
    await db.query(statements);

    expect(db).toBeDefined();

    const models = await getModels(packages, db);

    expect(models).toHaveLength(1);
    expect(models[0].slug).toBe('test');
  });

  test('drop a model', async () => {
    const definedModels: Array<Model> = [];
    const existingModels: Array<Model> = [TestA];

    const modelDiff = await diffModels(definedModels, existingModels);
    const packages = await getLocalPackages();
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);
    expect(statements).toHaveLength(2);

    const db = await queryEphemeralDatabase(existingModels);
    await db.query(statements);

    expect(db).toBeDefined();

    const models = await getModels(packages, db);

    expect(models).toHaveLength(0);
  });

  test('create a model with index', async () => {
    const definedModels: Array<Model> = [TestB];
    const existingModels: Array<Model> = [];

    const modelDiff = await diffModels(definedModels, existingModels);
    const packages = await getLocalPackages();
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);
    expect(statements).toHaveLength(4);

    const db = await queryEphemeralDatabase(existingModels);
    await db.query(statements);

    expect(db).toBeDefined();

    const models = await getModels(packages, db);

    expect(models).toHaveLength(1);
    expect(models[0].slug).toBe('test');
  });

  test('drop model with index', async () => {
    const definedModels: Array<Model> = [];
    const existingModels: Array<Model> = [TestB];

    const modelDiff = await diffModels(definedModels, existingModels);
    const packages = await getLocalPackages();
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);
    expect(statements).toHaveLength(2);

    const db = await queryEphemeralDatabase(existingModels);
    await db.query(statements);

    expect(db).toBeDefined();

    const models = await getModels(packages, db);

    expect(models).toHaveLength(0);
  });

  test('update a model', async () => {
    const definedModels: Array<Model> = [TestF];
    const existingModels: Array<Model> = [TestA];

    const modelDiff = await diffModels(definedModels, existingModels);
    const packages = await getLocalPackages();
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);

    expect(statements).toHaveLength(7);

    const db = await queryEphemeralDatabase(existingModels);

    expect(db).toBeDefined();

    await db.query(statements);

    const models = await getModels(packages, db);

    expect(models).toHaveLength(1);
    expect(models[0].slug).toBe('test');
  });

  test('update a model - rename', async () => {
    const definedModels: Array<Model> = [Account];
    const existingModels: Array<Model> = [AccountNew];

    const modelDiff = await diffModels(definedModels, existingModels, true);
    const packages = await getLocalPackages();
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);

    expect(statements).toHaveLength(2);

    const db = await queryEphemeralDatabase(existingModels);

    expect(db).toBeDefined();

    await db.query(statements);

    const models = await getModels(packages, db);

    expect(models).toHaveLength(1);
    expect(models[0].slug).toBe('account');
  });

  test('create multiple models with relationships', async () => {
    const definedModels: Array<Model> = [Account, Profile];
    const existingModels: Array<Model> = [];

    const modelDiff = await diffModels(definedModels, existingModels);
    const packages = await getLocalPackages();
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);
    expect(statements.length).toEqual(4);

    const db = await queryEphemeralDatabase(existingModels);
    await db.query(statements);

    const models = await getModels(packages, db);
    expect(models).toHaveLength(2);
  });

  test('update model meta properties', async () => {
    const definedModels: Array<Model> = [TestC];
    const existingModels: Array<Model> = [TestA];

    const modelDiff = await diffModels(definedModels, existingModels);
    const packages = await getLocalPackages();
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);
    const db = await queryEphemeralDatabase(existingModels);
    await db.query(statements);

    const models = await getModels(packages, db);
    expect(models[0].name).toBe('ThisIsACoolModel');
  });

  test('create model with triggers', async () => {
    const definedModels: Array<Model> = [TestC, TestD];
    const existingModels: Array<Model> = [];

    const modelDiff = await diffModels(definedModels, existingModels);
    const packages = await getLocalPackages();
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);

    const db = await queryEphemeralDatabase(existingModels);

    await db.query(statements);

    const models = await getModels(packages, db);
    expect(models).toHaveLength(2);
    expect(models[0].triggers).toBeDefined();
  });

  test('update model triggers', async () => {
    const definedModels: Array<Model> = [TestE, TestC];
    const existingModels: Array<Model> = [TestD];

    const db = await queryEphemeralDatabase(existingModels);
    const packages = await getLocalPackages();
    const models = await getModels(packages, db);

    const modelDiff = await diffModels(definedModels, models);

    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(packages, db);
    expect(newModels[0]?.triggers?.[0]?.action).toBe('DELETE');
  });

  test('complex model transformation with indexes and triggers', async () => {
    const definedModels: Array<Model> = [TestE, TestB];
    const existingModels: Array<Model> = [TestD, TestA];

    const db = await queryEphemeralDatabase(existingModels);
    const packages = await getLocalPackages();
    const models = await getModels(packages, db);

    const modelDiff = await diffModels(definedModels, models);

    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(packages, db);
    expect(newModels).toHaveLength(2);
  });

  test('rename model with existing relationships', async () => {
    const definedModels: Array<Model> = [AccountNew, Profile];
    const existingModels: Array<Model> = [Account, Profile];

    const db = await queryEphemeralDatabase(existingModels);
    const packages = await getLocalPackages();
    const models = await getModels(packages, db);

    const modelDiff = await diffModels(definedModels, models, true);

    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(packages, db);
    expect(newModels.find((m) => m.slug === 'account_new')).toBeDefined();
  });

  test('drop multiple models with dependencies', async () => {
    const definedModels: Array<Model> = [];
    const existingModels: Array<Model> = [Account, Profile, TestA];

    const db = await queryEphemeralDatabase(existingModels);
    const packages = await getLocalPackages();
    const models = await getModels(packages, db);

    const modelDiff = await diffModels(definedModels, models);

    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(packages, db);
    expect(newModels).toHaveLength(0);
  });

  test('change trigger', async () => {
    const definedModels: Array<Model> = [TestE];
    const existingModels: Array<Model> = [TestD];

    const db = await queryEphemeralDatabase(existingModels);
    const packages = await getLocalPackages();
    const models = await getModels(packages, db);
    const modelDiff = await diffModels(definedModels, models);

    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(packages, db);
    expect(newModels).toHaveLength(1);
  });

  test('complex model update with multiple changes', async () => {
    const definedModels: Array<Model> = [TestE, TestB, Account];
    const existingModels: Array<Model> = [TestD, TestA, AccountNew];

    const db = await queryEphemeralDatabase(existingModels);
    const packages = await getLocalPackages();
    const models = await getModels(packages, db);

    const modelDiff = await diffModels(definedModels, models, true);

    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(packages, db);
    expect(newModels).toHaveLength(3);
  });

  test('create and update models with mixed operations', async () => {
    const definedModels: Array<Model> = [TestB, TestE, Account];
    const existingModels: Array<Model> = [TestA, TestD];
    const db = await queryEphemeralDatabase(existingModels);
    const packages = await getLocalPackages();
    const models = await getModels(packages, db);

    const modelDiff = await diffModels(definedModels, models);

    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(packages, db);
    expect(newModels.length).toBeGreaterThan(1);
  });

  test('add field and change field property', async () => {
    const definedModels: Array<Model> = [TestG];
    const existingModels: Array<Model> = [TestF];

    const db = await queryEphemeralDatabase(existingModels);
    const packages = await getLocalPackages();
    const models = await getModels(packages, db);

    const modelDiff = await diffModels(definedModels, models);
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(packages, db);
    expect(newModels).toHaveLength(1);
  });

  test('migrate with no changes between model sets', async () => {
    const allModels = [TestG, Account, AccountNew, Profile];
    const db = await queryEphemeralDatabase(allModels);
    const packages = await getLocalPackages();
    const models = await getModels(packages, db);

    const modelDiff = await diffModels(allModels, models);
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(packages, db);
    expect(newModels.length).toBe(allModels.length);
  });

  test('create model with field rename', async () => {
    const definedModels: Array<Model> = [TestI];
    const existingModels: Array<Model> = [TestH];

    const db = await queryEphemeralDatabase(existingModels);
    const packages = await getLocalPackages();
    const models = await getModels(packages, db);

    const modelDiff = await diffModels(definedModels, models, true);

    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(packages, db);
    expect(newModels).toHaveLength(1);
  });

  test('create model with link cascade', async () => {
    const definedModels: Array<Model> = [TestE, TestK];
    const existingModels: Array<Model> = [TestE, TestJ];

    const db = await queryEphemeralDatabase(existingModels);
    const packages = await getLocalPackages();
    const models = await getModels(packages, db);

    const modelDiff = await diffModels(definedModels, models);
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(packages, db);
    expect(newModels).toHaveLength(2);
    // @ts-expect-error This is defined!
    expect(newModels[1]?.fields[0]?.actions?.onDelete).toBe('CASCADE');
  });

  test('change field type', async () => {
    const definedModels: Array<Model> = [TestM];
    const existingModels: Array<Model> = [TestL];

    const db = await queryEphemeralDatabase(existingModels);
    const packages = await getLocalPackages();
    const models = await getModels(packages, db);

    const modelDiff = await diffModels(definedModels, models);
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(packages, db);
    expect(newModels).toHaveLength(1);
    // @ts-expect-error This is defined!
    expect(newModels[0]?.fields[1]?.type).toBe('json');
  });
});
