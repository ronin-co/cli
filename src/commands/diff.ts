import fs from 'node:fs';
import path from 'node:path';
import apply from '@/src/commands/apply';
import { initializeDatabase } from '@/src/utils/database';
import { type MigrationFlags, diffModels } from '@/src/utils/migration';
import {
  MIGRATIONS_PATH,
  getLocalPackages,
  getModelDefinitions,
  logTableDiff,
} from '@/src/utils/misc';
import { getModels } from '@/src/utils/model';
import { Protocol } from '@/src/utils/protocol';
import { getOrSelectSpaceId } from '@/src/utils/space';
import { type Status, spinner } from '@/src/utils/spinner';
import type { Model } from '@ronin/compiler';

/**
 * Creates a new migration based on model differences.
 */
export default async (
  appToken: string | undefined,
  sessionToken: string | undefined,
  flags: MigrationFlags,
  positionals: Array<string>,
): Promise<void> => {
  let status: Status = 'readingConfig';
  spinner.text = 'Reading configuration';
  const modelsInCodePath =
    positionals[positionals.indexOf('diff') + 1] &&
    path.join(process.cwd(), positionals[positionals.indexOf('diff') + 1]);

  const packages = await getLocalPackages();
  const db = await initializeDatabase(packages);

  try {
    const space = await getOrSelectSpaceId(sessionToken, spinner);
    status = 'comparing';
    spinner.text = 'Comparing models';

    const [existingModels, definedModels] = await Promise.all([
      getModels(packages, db, appToken ?? sessionToken, space, flags.local),
      getModelDefinitions(modelsInCodePath),
    ]);

    if (flags.debug) {
      logModelDiffs(definedModels, existingModels);
    }

    spinner.stop();
    const modelDiff = await diffModels(definedModels, existingModels);
    spinner.start();

    if (modelDiff.length === 0) {
      spinner.succeed('No changes detected');
      return process.exit(0);
    }

    status = 'syncing';
    spinner.text = 'Writing migration protocol file';

    const nextNum = (() => {
      if (!fs.existsSync(MIGRATIONS_PATH)) return 1;
      const files = fs.readdirSync(MIGRATIONS_PATH);
      const migrationFiles = files.filter((f) => f.startsWith('migration-'));
      if (migrationFiles.length === 0) return 1;
      const numbers = migrationFiles.map((f) => Number.parseInt(f.split('-')[1]));
      return Math.max(...numbers) + 1;
    })();

    const paddedNum = String(nextNum).padStart(4, '0');
    const protocol = new Protocol(packages, modelDiff);
    await protocol.convertToQueryObjects();
    protocol.save(`migration-${paddedNum}`);

    if (flags.sql) {
      const allModels = [...existingModels, ...definedModels];
      await protocol.saveSQL(`migration-${paddedNum}`, allModels);
    }

    spinner.succeed('Successfully generated migration protocol file');

    // If desired, immediately apply the migration
    if (flags.apply) {
      await apply(appToken, sessionToken, flags);
    }

    process.exit(0);
  } catch (err) {
    const message =
      err instanceof packages.compiler.RoninError
        ? err.message
        : `Failed during ${status}: ${err instanceof Error ? err.message : err}`;
    spinner.fail(message);

    process.exit(1);
  }
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
