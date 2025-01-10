import { select } from '@inquirer/prompts';
import ora, { type Ora } from 'ora';

import fs from 'node:fs';
import path from 'node:path';
import type { parseArgs } from 'node:util';
import { readConfig, saveConfig } from '@/src/utils/config';
import { initializeDatabase } from '@/src/utils/database';
import { diffModels } from '@/src/utils/migration';
import {
  type BaseFlags,
  MODELS_IN_CODE_DIR,
  getModelDefinitions,
  logTableDiff,
} from '@/src/utils/misc';
import { getModels } from '@/src/utils/model';
import { Protocol } from '@/src/utils/protocol';
import { getSpaces } from '@/src/utils/space';
import { type Status, spinner } from '@/src/utils/spinner';
import type { Model } from '@ronin/compiler';
import type { Database } from '@ronin/engine';

export const MIGRATION_FLAGS = {
  reset: { type: 'boolean', short: 'r', default: false },
  sql: { type: 'boolean', short: 's', default: false },
  apply: { type: 'boolean', short: 'a', default: false },
  prod: { type: 'boolean', short: 'p', default: false },
} satisfies NonNullable<Parameters<typeof parseArgs>[0]>['options'];

type Flags = BaseFlags & Partial<Record<keyof typeof MIGRATION_FLAGS, boolean>>;

/**
 * Handles migration commands for creating and applying database migrations.
 */
export default async function main(
  appToken: string | undefined,
  sessionToken: string | undefined,
  flags: BaseFlags,
  positionals: Array<string>,
): Promise<void> {
  const subCommand = positionals[positionals.indexOf('migration') + 1];

  try {
    switch (subCommand) {
      case 'apply':
        await apply(appToken, sessionToken, flags, positionals);
        break;
      case 'create':
        await create(appToken, sessionToken, flags);
        break;
      default: {
        spinner.fail('Please specify a valid sub command.');
        process.exit(1);
      }
    }
  } catch (error) {
    spinner.fail(
      `An unexpected error occurred: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(1);
  }
}

/**
 * Applies migration statements to the database.
 */
const applyMigrationStatements = async (
  appTokenOrSessionToken: string | undefined,
  flags: Flags,
  db: Database,
  statements: Array<{ statement: string }>,
  slug: string,
): Promise<void> => {
  if (flags.prod) {
    spinner.info('Applying migration to production database');

    await fetch(`https://data.ronin.co/?data-selector=${slug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${appTokenOrSessionToken}`,
      },
      body: JSON.stringify({
        nativeQueries: statements.map((query) => ({
          query: query.statement,
          mode: 'write',
        })),
      }),
    });

    return;
  }

  spinner.info('Applying migration to local database');

  await db.query(statements.map(({ statement }) => statement));
  fs.writeFileSync('.ronin/db.sqlite', await db.getContents());
};

/**
 * Creates a new migration based on model differences.
 */
const create = async (
  appToken: string | undefined,
  sessionToken: string | undefined,
  flags: Flags,
): Promise<void> => {
  let status: Status = 'readingConfig';
  spinner.start('Reading configuration');

  const db = await initializeDatabase();

  try {
    const { slug } = await getOrSelectSpaceId(sessionToken, spinner);
    status = 'comparing';
    spinner.text = 'Comparing models';

    const [existingModels, definedModels] = await Promise.all([
      getModels(db, appToken ?? sessionToken, slug, flags.prod),
      getModelDefinitions(),
    ]);

    if (flags.debug) {
      logModelDiffs(definedModels, existingModels);
    }

    spinner.stopAndPersist();
    const modelDiff = await diffModels(definedModels, existingModels);
    spinner.start();

    if (modelDiff.length === 0) {
      spinner.succeed('No changes detected');
      return process.exit(0);
    }

    status = 'syncing';
    spinner.text = 'Writing migration protocol file';

    const migrationsDir = path.join(process.cwd(), MODELS_IN_CODE_DIR, '.protocols');
    const nextNum = (() => {
      if (!fs.existsSync(migrationsDir)) return 1;
      const files = fs.readdirSync(migrationsDir);
      const migrationFiles = files.filter((f) => f.startsWith('migration-'));
      if (migrationFiles.length === 0) return 1;
      const numbers = migrationFiles.map((f) => Number.parseInt(f.split('-')[1]));
      return Math.max(...numbers) + 1;
    })();

    const paddedNum = String(nextNum).padStart(4, '0');
    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();
    await protocol.save(`migration-${paddedNum}`);

    if (flags.sql) {
      const allModels = [...existingModels, ...definedModels];
      await protocol.saveSQL(`migration-${paddedNum}`, allModels);
    }

    spinner.succeed('Successfully generated migration protocol file');

    if (flags.apply) {
      const statements = protocol.getSQLStatements(existingModels);
      const migrationsPath = path.join(process.cwd(), MODELS_IN_CODE_DIR, 'migrations');

      if (!fs.existsSync(migrationsPath)) {
        fs.mkdirSync(migrationsPath, { recursive: true });
      }

      fs.copyFileSync(
        path.join(
          process.cwd(),
          MODELS_IN_CODE_DIR,
          '.protocols',
          `migration-${paddedNum}.ts`,
        ),
        path.join(migrationsPath, `migration-${paddedNum}.ts`),
      );

      await applyMigrationStatements(
        appToken ?? sessionToken,
        flags,
        db,
        statements,
        slug,
      );
    }

    process.exit(0);
  } catch (err) {
    spinner.fail(
      `Failed during ${status}:\n ${err instanceof Error ? err.message : err}`,
    );
    throw err;
  }
};

/**
 * Applies a migration file to the database.
 */
const apply = async (
  appToken: string | undefined,
  sessionToken: string | undefined,
  flags: Flags,
  positionals: Array<string>,
): Promise<void> => {
  const spinner = ora('Applying migration').start();
  const migrationFilePath = positionals[positionals.indexOf('migration') + 2];

  const db = await initializeDatabase();

  try {
    const { slug } = await getOrSelectSpaceId(sessionToken, spinner);
    const existingModels = await getModels(
      db,
      appToken ?? sessionToken,
      slug,
      flags.prod,
    );
    const protocol = await new Protocol().load(migrationFilePath);
    const statements = protocol.getSQLStatements(existingModels);

    const files = fs.readdirSync(
      path.join(process.cwd(), MODELS_IN_CODE_DIR, '.protocols'),
    );
    const latestProtocolFile = files.sort().pop() || 'migration';

    const migrationsPath = path.join(process.cwd(), MODELS_IN_CODE_DIR, 'migrations');

    if (!fs.existsSync(migrationsPath)) {
      fs.mkdirSync(migrationsPath, { recursive: true });
    }

    fs.copyFileSync(
      migrationFilePath ||
        path.join(
          process.cwd(),
          MODELS_IN_CODE_DIR,
          '.protocols',
          path.basename(latestProtocolFile),
        ),
      path.join(migrationsPath, path.basename(latestProtocolFile)),
    );

    await applyMigrationStatements(appToken ?? sessionToken, flags, db, statements, slug);

    spinner.succeed('Successfully applied migration');
    process.exit(0);
  } catch (error) {
    spinner.fail('Failed to apply migration');
    throw error;
  }
};

/**
 * Helper to get or interactively select a space ID.
 */
const getOrSelectSpaceId = async (
  sessionToken?: string,
  spinner?: Ora,
): Promise<{ id: string; slug: string }> => {
  const config = readConfig();
  let space = { id: config.spaceId, slug: config.spaceSlug };

  if (!space.id && sessionToken) {
    const spaces = await getSpaces(sessionToken);

    if (spaces?.length === 0) {
      throw new Error(
        "You don't have access to any space or your CLI session is invalid.\n\n" +
          'Please login again (by running `npx ronin login`) or ' +
          'create a new space on the dashboard (`https://ronin.co/new`) and try again.',
      );
    }

    if (spaces.length === 1) {
      space = { id: spaces[0].id, slug: spaces[0].handle };
    } else {
      spinner?.stop();
      space = await select({
        message: 'Which space do you want to apply models to?',
        choices: spaces.map((space) => ({
          name: space.handle,
          value: { id: space.id, slug: space.handle },
          description: space.name,
        })),
      });
    }

    saveConfig({ spaceId: space.id, spaceSlug: space.slug });
  }

  if (!space) {
    throw new Error('Space ID is not specified.');
  }

  return {
    id: space.id!,
    slug: space.slug!,
  };
};

/**
 * Helper to log model differences in debug mode.
 */
const logModelDiffs = (
  definedModels: Array<Model>,
  existingModels: Array<Model>,
): void => {
  for (const existingModel of existingModels) {
    const definedModel = definedModels.find((local) => local.slug === existingModel.slug);
    if (definedModel && definedModel !== existingModel) {
      logTableDiff(definedModel, existingModel, definedModel.slug);
    }
  }
};
