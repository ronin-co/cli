import type { Model } from '@ronin/compiler';
import { add } from 'ronin';
import { blob, boolean, date, link, model, number, string } from 'ronin/schema';

export const CONSTANTS = {
  FIRSTNAME: 'Cornelius',
  LASTNAME: 'Denninger',
};

const TestAccount = model({
  slug: 'account',
  fields: {
    name: string(),
    email: string({ unique: true }),
    birthday: date(),
  },

  presets: {
    over18: {
      with: {
        age: {
          being: {
            greaterThan: 18,
          },
        },
      },
    },
  },
}) as unknown as Model;

const TestAccount2 = model({
  slug: 'accountNew',
  fields: {
    name: string(),
    email: string({ unique: true }),
    birthday: date(),
  },

  presets: {
    over18: {
      with: {
        age: {
          being: {
            greaterThan: 18,
          },
        },
      },
    },
  },
}) as unknown as Model;

const TestProfile2 = model({
  slug: 'profileNew',
  fields: {
    usernameNew: string({ required: true, unique: true }),
    avatar: string(),
    account: link({
      target: 'accountNew',
      required: true,
      actions: { onDelete: 'CASCADE' },
    }),
  },
}) as unknown as Model;

const TestProfile = model({
  slug: 'profile',
  fields: {
    username: string({ required: true, unique: true }),
    avatar: string(),
    account: link({
      target: 'account',
      required: true,
      actions: { onDelete: 'CASCADE' },
    }),
  },
}) as unknown as Model;

const TestBlog = model({
  slug: 'blog',
  fields: {
    name: string(),
    author: link({ target: 'profile', required: true }),
    published: boolean({ defaultValue: false }),
    hero: blob(),
  },

  indexes: [
    {
      fields: [{ slug: 'author' }, { slug: 'name' }],
      unique: true,
    },
  ],
}) as unknown as Model;

const TestBlog2 = model({
  slug: 'blog',
  fields: {
    name: string(),
    authorNew: link({ target: 'profileNew', required: true }),
    published: boolean({ defaultValue: false }),
    hero: blob(),
  },

  indexes: [
    {
      fields: [{ slug: 'authorNew' }, { slug: 'name' }],
      unique: true,
    },
  ],
}) as unknown as Model;

const TestComments = model({
  slug: 'comments',
  fields: {
    content: string(),
  },
}) as unknown as Model;

// Define a few simple models with triggers, indexes and presets.
// Furthermore the models contain fields with different attributes.
export const ModelsA = [TestAccount, TestProfile, TestBlog];
// ModelsB adds one more model, renames a model and renames a field.
export const ModelsB = [TestAccount2, TestProfile2, TestBlog2, TestComments];
/* export const ModelsC = [Account2, Profile]; */

export const Account = model({
  slug: 'account',
  pluralSlug: 'accounts',
  fields: {
    name: string(),
  },
}) as unknown as Model;

export const AccountNew = model({
  slug: 'account_new',
  pluralSlug: 'accounts_new',
  fields: {
    name: string(),
  },
}) as unknown as Model;

export const Account2 = model({
  slug: 'account',
  pluralSlug: 'accounts',
  fields: {
    name: string({
      required: true,
      unique: true,
    }),
  },
}) as unknown as Model;

export const Profile = model({
  slug: 'profile',
  fields: {
    username: string(),
  },
}) as unknown as Model;

export const TestA = model({
  slug: 'test',
  fields: {
    age: string({ required: true, unique: true }),
    active: boolean(),
  },
  indexes: [{ fields: [{ slug: 'age' }], unique: true }],
}) as unknown as Model;

export const TestB = model({
  slug: 'test',
  fields: {
    name: string(),
    age: number({ defaultValue: 18 }),
    createdAt: date({ defaultValue: '02-02-2024' }),
  },
  indexes: [{ fields: [{ slug: 'age' }, { slug: 'name' }], unique: true }],
}) as unknown as Model;

export const TestC = model({
  slug: 'test',
  name: 'ThisIsACoolModel',
  idPrefix: 'TICM',
  fields: {
    age: string({ required: true, unique: true }),
    active: boolean(),
  },
  indexes: [{ fields: [{ slug: 'age' }], unique: true }],
}) as unknown as Model;

export const TestD = model({
  slug: 'comment',
  fields: {
    name: string(),
  },
  triggers: [
    {
      action: 'INSERT',
      when: 'BEFORE',
      // @ts-expect-error Fix in models
      effects: (): Array<Effect> => [add.comment.to({ name: 'Test' })],
    },
  ],
}) as unknown as Model;

export const TestE = model({
  slug: 'comment',
  fields: {
    name: string(),
  },
  triggers: [
    {
      action: 'DELETE',
      when: 'AFTER',
      // @ts-expect-error Fix in models
      effects: (): Array<Effect> => [add.comment.to({ name: 'Test' })],
    },
  ],
}) as unknown as Model;

export const TestF = model({
  slug: 'test',
  fields: {
    age: string({ required: false, unique: false }),
    active: boolean(),
  },
  indexes: [{ fields: [{ slug: 'age' }], unique: true }],
}) as unknown as Model;

export const TestG = model({
  slug: 'test',
  fields: {
    age: string({ required: true, unique: true }),
    name: string(),
  },
}) as unknown as Model;

export const TestH = model({
  slug: 'test',
  fields: {
    age: string(),
    name: string(),
    description: string(),
  },
}) as unknown as Model;

export const TestI = model({
  slug: 'test',
  fields: {
    age: string(),
    name: string(),
    bio: string(),
    colour: string(),
  },
}) as unknown as Model;
