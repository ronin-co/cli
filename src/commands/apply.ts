import ora from 'ora';

import fs from 'node:fs';
import path from 'node:path';
import { initializeDatabase } from '@/src/utils/database';
import type { MigrationFlags } from '@/src/utils/migration';
import { MODELS_IN_CODE_DIR, getLocalPackages } from '@/src/utils/misc';
import { getModels } from '@/src/utils/model';
import { Protocol } from '@/src/utils/protocol';
import { getOrSelectSpaceId } from '@/src/utils/space';
import { spinner } from '@/src/utils/spinner';
import type { Database } from '@ronin/engine';

/**
 * Applies a migration file to the database.
 */
export default async (
  appToken: string | undefined,
  sessionToken: string | undefined,
  flags: MigrationFlags,
  positionals: Array<string>,
): Promise<void> => {
  const spinner = ora('Applying migration').start();
  const migrationFilePath = positionals[positionals.indexOf('apply') + 1];

  const packages = await getLocalPackages();
  const db = await initializeDatabase(packages);

  try {
    const { slug } = await getOrSelectSpaceId(sessionToken, spinner);
    const existingModels = await getModels(
      packages,
      db,
      appToken ?? sessionToken,
      slug,
      flags.local,
    );
    const protocol = await new Protocol(packages).load(migrationFilePath);
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
  } catch (err) {
    const message =
      err instanceof packages.compiler.RoninError
        ? err.message
        : 'Failed to apply migration';
    spinner.fail(message);
    spinner.fail(err instanceof Error ? err.message : String(err));

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
    spinner.info('Applying migration to local database');

    await db.query(statements.map(({ statement }) => statement));
    fs.writeFileSync('.ronin/db.sqlite', await db.getContents());

    return;
  }

  spinner.info('Applying migration to production database');

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
