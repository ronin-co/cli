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
} from '@/fixtures/index';

import { describe, expect, test } from 'bun:test';
import { queryEphemeralDatabase } from '@/fixtures/utils';
import { diffModels } from '@/src/utils/migration';
import { getModels } from '@/src/utils/model';
import { Protocol } from '@/src/utils/protocol';
import type { Model } from '@ronin/compiler';

describe('apply', () => {
  test('create a model', async () => {
    const definedModels: Array<Model> = [TestA];
    const existingModels: Array<Model> = [];

    const modelDiff = await diffModels(definedModels, existingModels);
    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);
    expect(statements).toHaveLength(4);

    const db = await queryEphemeralDatabase(existingModels);
    await db.query(statements);

    expect(db).toBeDefined();

    const models = await getModels(db);

    expect(models).toHaveLength(1);
    expect(models[0].slug).toBe('test');
  });

  test('drop a model', async () => {
    const definedModels: Array<Model> = [];
    const existingModels: Array<Model> = [TestA];

    const modelDiff = await diffModels(definedModels, existingModels);
    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);
    expect(statements).toHaveLength(2);

    const db = await queryEphemeralDatabase(existingModels);
    await db.query(statements);

    expect(db).toBeDefined();

    const models = await getModels(db);

    expect(models).toHaveLength(0);
  });

  test('create a model with index', async () => {
    const definedModels: Array<Model> = [TestB];
    const existingModels: Array<Model> = [];

    const modelDiff = await diffModels(definedModels, existingModels);
    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);
    expect(statements).toHaveLength(4);

    const db = await queryEphemeralDatabase(existingModels);
    await db.query(statements);

    expect(db).toBeDefined();

    const models = await getModels(db);

    expect(models).toHaveLength(1);
    expect(models[0].slug).toBe('test');
  });

  test('drop model with index', async () => {
    const definedModels: Array<Model> = [];
    const existingModels: Array<Model> = [TestB];

    const modelDiff = await diffModels(definedModels, existingModels);
    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);
    expect(statements).toHaveLength(2);

    const db = await queryEphemeralDatabase(existingModels);
    await db.query(statements);

    expect(db).toBeDefined();

    const models = await getModels(db);

    expect(models).toHaveLength(0);
  });

  test('update a model', async () => {
    const definedModels: Array<Model> = [TestF];
    const existingModels: Array<Model> = [TestA];

    const modelDiff = await diffModels(definedModels, existingModels);
    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);

    expect(statements).toHaveLength(9);

    const db = await queryEphemeralDatabase(existingModels);

    expect(db).toBeDefined();

    await db.query(statements);

    const models = await getModels(db);

    expect(models).toHaveLength(1);
    expect(models[0].slug).toBe('test');
  });

  test('update a model - rename', async () => {
    const definedModels: Array<Model> = [Account];
    const existingModels: Array<Model> = [AccountNew];

    const modelDiff = await diffModels(definedModels, existingModels, true);
    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);

    expect(statements).toHaveLength(2);

    const db = await queryEphemeralDatabase(existingModels);

    expect(db).toBeDefined();

    await db.query(statements);

    const models = await getModels(db);

    expect(models).toHaveLength(1);
    expect(models[0].slug).toBe('account');
  });

  test('create multiple models with relationships', async () => {
    const definedModels: Array<Model> = [Account, Profile];
    const existingModels: Array<Model> = [];

    const modelDiff = await diffModels(definedModels, existingModels);
    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);
    expect(statements.length).toEqual(4);

    const db = await queryEphemeralDatabase(existingModels);
    await db.query(statements);

    const models = await getModels(db);
    expect(models).toHaveLength(2);
  });

  test('update model meta properties', async () => {
    const definedModels: Array<Model> = [TestC];
    const existingModels: Array<Model> = [TestA];

    const modelDiff = await diffModels(definedModels, existingModels);
    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);
    const db = await queryEphemeralDatabase(existingModels);
    await db.query(statements);

    const models = await getModels(db);
    expect(models[0].name).toBe('ThisIsACoolModel');
  });

  test('create model with triggers', async () => {
    const definedModels: Array<Model> = [TestC, TestD];
    const existingModels: Array<Model> = [];

    const modelDiff = await diffModels(definedModels, existingModels);
    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(existingModels);

    const db = await queryEphemeralDatabase(existingModels);
    console.log('STATEMENTS', statements);
    await db.query(statements);

    const models = await getModels(db);
    expect(models).toHaveLength(2);
    expect(models[0].triggers).toBeDefined();
  });

  test('update model triggers', async () => {
    const definedModels: Array<Model> = [TestE, TestC];
    const existingModels: Array<Model> = [TestD];

    const db = await queryEphemeralDatabase(existingModels);
    const models = await getModels(db);

    const modelDiff = await diffModels(definedModels, models);

    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(db);

    expect(newModels[1]?.triggers?.[0]?.action).toBe('DELETE');
  });

  test('complex model transformation with indexes and triggers', async () => {
    const definedModels: Array<Model> = [TestE, TestB];
    const existingModels: Array<Model> = [TestD, TestA];

    const db = await queryEphemeralDatabase(existingModels);
    const models = await getModels(db);

    const modelDiff = await diffModels(definedModels, models);

    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(db);
    expect(newModels).toHaveLength(2);
  });

  test('rename model with existing relationships', async () => {
    const definedModels: Array<Model> = [AccountNew, Profile];
    const existingModels: Array<Model> = [Account, Profile];

    const db = await queryEphemeralDatabase(existingModels);
    const models = await getModels(db);

    const modelDiff = await diffModels(definedModels, models, true);

    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(db);
    expect(newModels.find((m) => m.slug === 'account_new')).toBeDefined();
  });

  test('drop multiple models with dependencies', async () => {
    const definedModels: Array<Model> = [];
    const existingModels: Array<Model> = [Account, Profile, TestA];

    const db = await queryEphemeralDatabase(existingModels);
    const models = await getModels(db);

    const modelDiff = await diffModels(definedModels, models);

    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(db);
    expect(newModels).toHaveLength(0);
  });

  test('complex model update with multiple changes', async () => {
    const definedModels: Array<Model> = [TestE, TestB, Account];
    const existingModels: Array<Model> = [TestD, TestA, AccountNew];

    const db = await queryEphemeralDatabase(existingModels);
    const models = await getModels(db);

    const modelDiff = await diffModels(definedModels, models, true);

    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(db);
    expect(newModels).toHaveLength(3);
  });

  test('create and update models with mixed operations', async () => {
    const definedModels: Array<Model> = [TestB, TestE, Account];
    const existingModels: Array<Model> = [TestA, TestD];
    const db = await queryEphemeralDatabase(existingModels);

    const models = await getModels(db);

    const modelDiff = await diffModels(definedModels, models);

    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);
    await db.query(statements);

    const newModels = await getModels(db);
    expect(newModels.length).toBeGreaterThan(1);
  });
});
