import { Account, AccountNew, TestA, TestB, TestF } from '@/fixtures/index';

import { describe, expect, test } from 'bun:test';
import { prefilledDatabase } from '@/fixtures/utils';
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

    const statements = await protocol.getSQLStatements(existingModels);
    expect(statements).toHaveLength(4);

    const db = await prefilledDatabase(existingModels);
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

    const db = await prefilledDatabase(existingModels);
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

    const db = await prefilledDatabase(existingModels);
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

    const db = await prefilledDatabase(existingModels);
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

    const db = await prefilledDatabase(existingModels);

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

    const db = await prefilledDatabase(existingModels);

    expect(db).toBeDefined();

    await db.query(statements);

    const models = await getModels(db);

    expect(models).toHaveLength(1);
    expect(models[0].slug).toBe('account');
  });
});
