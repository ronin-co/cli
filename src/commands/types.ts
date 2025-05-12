import fs from 'node:fs/promises';
import path from 'node:path';

import type { parseArgs } from 'node:util';
import { type BaseFlags, getLocalPackages } from '@/src/utils/misc';
import { getOrSelectSpaceId } from '@/src/utils/space';
import { spinner as ora } from '@/src/utils/spinner';
import {
  TYPES_DTS_FILE_NAME,
  ZOD_SCHEMA_FILE_NAME,
  getSpaceTypes,
  getZodSchemas,
  injectTSConfigInclude,
} from '@/src/utils/types';

/**
 * Command line flags for types operations.
 */
export const TYPES_FLAGS = {
  zod: { type: 'boolean', short: 'z', default: false },
} satisfies NonNullable<Parameters<typeof parseArgs>[0]>['options'];

export type TypesFlags = BaseFlags & Partial<Record<keyof typeof TYPES_FLAGS, boolean>>;

export default async (
  appToken: string | undefined,
  sessionToken: string | undefined,
  flags?: TypesFlags,
): Promise<void> => {
  const spinner = ora.info(flags?.zod ? 'Generating Zod schemas' : 'Generating types');

  const packages = await getLocalPackages();

  try {
    const space = await getOrSelectSpaceId(sessionToken, spinner);

    const configDir = path.join(process.cwd(), '.ronin');
    const configDirExists = await fs.exists(configDir);
    if (!configDirExists) await fs.mkdir(configDir);

    if (flags?.zod) {
      const zodSchemas = await getZodSchemas(appToken ?? sessionToken, space);
      await fs.writeFile(path.join(configDir, ZOD_SCHEMA_FILE_NAME), zodSchemas);
    } else {
      const code = await getSpaceTypes(appToken ?? sessionToken, space);

      const typesFilePath = path.join(configDir, TYPES_DTS_FILE_NAME);
      await fs.writeFile(typesFilePath, code);

      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      const tsconfigContents = await injectTSConfigInclude(tsconfigPath);
      await fs.writeFile(tsconfigPath, JSON.stringify(tsconfigContents, null, 2));
    }

    spinner.succeed('Successfully generated types');
  } catch (err) {
    const message =
      err instanceof packages.compiler.RoninError
        ? err.message
        : 'Failed to generate types';

    spinner.fail(message);

    !(err instanceof packages.compiler.RoninError) &&
      err instanceof Error &&
      spinner.fail(err.message);

    process.exit(1);
  }
};
