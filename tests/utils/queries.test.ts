import { describe, expect, test } from 'bun:test';
import {
  createFieldQuery,
  createIndexQuery,
  createModelQuery,
  createTempColumnQuery,
  createTempModelQuery,
  createTriggerQuery,
  dropFieldQuery,
  dropIndexQuery,
  dropModelQuery,
  dropTriggerQuery,
  renameFieldQuery,
  renameModelQuery,
  setFieldQuery,
} from '@/src/utils/queries';
import type { ModelField, ModelTrigger } from '@ronin/compiler';

describe('queries', () => {
  test('drop model query', () => {
    const result = dropModelQuery('user');
    expect(result).toBe('drop.model("user")');
  });

  test('create model query without properties', () => {
    const result = createModelQuery('user');
    expect(result).toBe("create.model({slug:'user'})");
  });

  test('create model query with properties', () => {
    const result = createModelQuery('user', {
      pluralSlug: 'users',
      name: 'User',
      pluralName: 'Users',
      fields: [
        {
          slug: 'username',
          type: 'string',
          name: 'Username',
          unique: true,
          required: true,
        },
      ],
    });
    expect(result).toBe(
      "create.model({slug:'user',pluralSlug:'users', name:'User', pluralName:'Users', fields:[{slug:'username', type:'string', name:'Username', unique:true, required:true}]})",
    );
  });

  test('create field query for non-link field', () => {
    const field: ModelField = {
      slug: 'username',
      type: 'string',
      name: 'Username',
      unique: true,
      required: true,
    };
    const result = createFieldQuery('user', field);
    expect(result).toBe(`alter.model('user').create.field(${JSON.stringify(field)})`);
  });

  test('create field query for link field', () => {
    const field: ModelField = {
      slug: 'profile',
      type: 'link',
      name: 'Profile',
      target: 'profile',
    };
    const result = createFieldQuery('user', field);
    expect(result).toBe(`alter.model('user').create.field(${JSON.stringify(field)})`);
  });

  test('create field query for link field', () => {
    const field: ModelField = {
      slug: 'profile',
      type: 'link',
      name: 'Profile',
      target: 'profile',
    };
    const result = createFieldQuery('user', field);
    expect(result).toBe(`alter.model('user').create.field(${JSON.stringify(field)})`);
  });

  test('set field query', () => {
    const result = setFieldQuery('user', 'username', { unique: true });
    expect(result).toBe(
      'alter.model("user").alter.field("username").to({"unique":true})',
    );
  });

  test('drop field query', () => {
    const result = dropFieldQuery('user', 'username');
    expect(result).toBe('alter.model("user").drop.field("username")');
  });

  test('create temp model query', () => {
    const fields: Array<ModelField> = [
      {
        slug: 'username',
        type: 'string',
        name: 'Username',
        unique: true,
        required: true,
      },
    ];
    const result = createTempModelQuery({ slug: 'user', fields });
    expect(result).toEqual([
      "create.model({slug:'RONIN_TEMP_user',fields:[{slug:'username', type:'string', name:'Username', unique:true, required:true}]})",
      'add.RONIN_TEMP_user.with(() => get.user())',
      'drop.model("user")',
      'alter.model("RONIN_TEMP_user").to({slug: "user"})',
    ]);
  });

  test('create temp model query with custom queries', () => {
    const fields: Array<ModelField> = [
      {
        slug: 'username',
        type: 'string',
        name: 'Username',
        unique: true,
        required: true,
      },
    ];
    const customQueries: Array<string> = ['get.model("user")'];
    const result = createTempModelQuery({ slug: 'user', fields }, customQueries);
    expect(result).toEqual([
      "create.model({slug:'RONIN_TEMP_user',fields:[{slug:'username', type:'string', name:'Username', unique:true, required:true}]})",
      'add.RONIN_TEMP_user.with(() => get.user())',
      ...customQueries,
      'drop.model("user")',
      'alter.model("RONIN_TEMP_user").to({slug: "user"})',
    ]);
  });

  test('create temp model query with triggers', () => {
    const fields: Array<ModelField> = [
      {
        slug: 'username',
        type: 'string',
        name: 'Username',
        unique: true,
        required: true,
      },
    ];
    const triggers: Array<ModelTrigger> = [
      {
        action: 'INSERT',
        when: 'BEFORE',
        effects: [],
      },
    ];
    const result = createTempModelQuery({ slug: 'user', fields, triggers });
    expect(result).toEqual([
      "create.model({slug:'RONIN_TEMP_user',fields:[{slug:'username', type:'string', name:'Username', unique:true, required:true}]})",
      'add.RONIN_TEMP_user.with(() => get.user())',
      'drop.model("user")',
      'alter.model("RONIN_TEMP_user").to({slug: "user"})',
      'alter.model("user").create.trigger({"action":"INSERT","when":"BEFORE","effects":[]})',
    ]);
  });

  test('rename model query', () => {
    const result = renameModelQuery('user', 'account');
    expect(result).toBe('alter.model("user").to({slug: "account"})');
  });

  test('rename field query', () => {
    const result = renameFieldQuery('user', 'email', 'emailAddress');
    expect(result).toBe(
      'alter.model("user").alter.field("email").to({slug: "emailAddress"})',
    );
  });

  test('add trigger query', () => {
    const result = createTriggerQuery('user', {
      action: 'INSERT',
      when: 'BEFORE',
      effects: [],
    });
    expect(result).toBe(
      'alter.model("user").create.trigger({"action":"INSERT","when":"BEFORE","effects":[]})',
    );
  });

  test('drop trigger query', () => {
    const result = dropTriggerQuery('user', 'validateEmail');
    expect(result).toBe('alter.model("user").drop.trigger("validateEmail")');
  });

  test('add index query', () => {
    const result = createIndexQuery('user', {
      fields: [{ slug: 'email' }],
      unique: true,
    });

    expect(result).toBe(
      'alter.model("user").create.index({"fields":[{"slug":"email"}],"unique":true})',
    );
  });

  test('drop index query', () => {
    const result = dropIndexQuery('user', 'emailIndex');
    expect(result).toBe('alter.model("user").drop.index("emailIndex")');
  });

  test('create temp column query', () => {
    const result = createTempColumnQuery(
      'user',
      {
        slug: 'username',
        type: 'string',
        name: 'Username',
        unique: true,
        required: true,
      },
      [],
      [],
    );
    expect(result).toEqual([
      `alter.model('user').create.field({"slug":"RONIN_TEMP_username","type":"string","name":"Username","unique":true,"required":true})`,
      'set.user.to.RONIN_TEMP_username(f => f.username)',
      'alter.model("user").drop.field("username")',
      'alter.model("user").alter.field("RONIN_TEMP_username").to({slug: "username"})',
    ]);
  });
});
