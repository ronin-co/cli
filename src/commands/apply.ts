import fs from 'node:fs';
import path from 'node:path';
import { initializeDatabase } from '@/src/utils/database';
import type { MigrationFlags } from '@/src/utils/migration';
import { MIGRATIONS_PATH, getLocalPackages } from '@/src/utils/misc';
import { getModels } from '@/src/utils/model';
import { Protocol } from '@/src/utils/protocol';
import { getOrSelectSpaceId } from '@/src/utils/space';
import { spinner as ora } from '@/src/utils/spinner';
import { select } from '@inquirer/prompts';
import type { Database } from '@ronin/engine';

/**
 * Applies a migration file to the database.
 */
export default async (
  appToken: string | undefined,
  sessionToken: string | undefined,
  flags: MigrationFlags,
  migrationFilePath?: string,
): Promise<void> => {
  const spinner = ora.info('Applying migration');

  const packages = await getLocalPackages();
  const db = await initializeDatabase(packages);

  try {
    const space = await getOrSelectSpaceId(sessionToken, spinner);
    const existingModels = await getModels(
      packages,
      db,
      appToken ?? sessionToken,
      space,
      flags.local,
    );

    // Get all filenames of migrations in the migrations directory.
    const migrations = fs.readdirSync(MIGRATIONS_PATH);

    const migrationPrompt =
      migrationFilePath ??
      (await select({
        message: 'Which migration do you want to apply?',
        choices: migrations
          // Sort in reverse lexical order
          .sort((a, b) => b.localeCompare(a))
          .map((migration) => ({
            name: migration,
            value: path.join(MIGRATIONS_PATH, migration),
          })),
      }));

    const protocol = await new Protocol(packages).load(migrationPrompt);
    const statements = protocol.getSQLStatements(existingModels);

    // Create the migrations directory if it doesn't exist.
    if (!fs.existsSync(MIGRATIONS_PATH)) {
      fs.mkdirSync(MIGRATIONS_PATH, { recursive: true });
    }

    await applyMigrationStatements(
      appToken ?? sessionToken,
      flags,
      db,
      statements,
      space,
    );

    spinner.succeed('Successfully applied migration');
    process.exit(0);
  } catch (err) {
    const message =
      err instanceof packages.compiler.RoninError
        ? err.message
        : 'Failed to apply migration';
    spinner.fail(message);
    !(err instanceof packages.compiler.RoninError) &&
      err instanceof Error &&
      spinner.fail(err.message);

    process.exit(1);
  }
};

/**
 * Applies migration statements to the database.
 */
const applyMigrationStatements = async (
  appTokenOrSessionToken: string | undefined,
  flags: MigrationFlags,
  db: Database,
  statements: Array<{ statement: string }>,
  slug: string,
): Promise<void> => {
  if (flags.local) {
    ora.info('Applying migration to local database');

    await db.query(statements.map(({ statement }) => statement));
    fs.writeFileSync('.ronin/db.sqlite', await db.getContents());

    return;
  }

  ora.info('Applying migration to production database');

  const response = await fetch(`https://data.ronin.co/?data-selector=${slug}`, {
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

  const result = (await response.json()) as { error: { message: string } };

  if (!response.ok) {
    throw new Error(result.error.message);
  }
};
