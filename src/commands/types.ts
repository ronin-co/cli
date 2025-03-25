import fs from 'node:fs/promises';
import path from 'node:path';

import { getLocalPackages } from '@/src/utils/misc';
import { getOrSelectSpaceId } from '@/src/utils/space';
import { spinner as ora } from '@/src/utils/spinner';
import {
  TYPES_DTS_FILE_NAME,
  appendTypesToConfig,
  getSpaceTypes,
} from '@/src/utils/types';

export default async (
  appToken: string | undefined,
  sessionToken: string | undefined,
): Promise<void> => {
  const spinner = ora.info('Generating types');

  const packages = await getLocalPackages();

  try {
    const space = await getOrSelectSpaceId(sessionToken, spinner);

    const configDir = path.join(process.cwd(), '.ronin');
    const configDirExists = await fs.exists(configDir);
    if (!configDirExists) await fs.mkdir(configDir);

    const code = await getSpaceTypes(appToken ?? sessionToken, space);

    const typesFilePath = path.join(configDir, TYPES_DTS_FILE_NAME);
    await fs.writeFile(typesFilePath, code);

    await appendTypesToConfig();

    spinner.succeed('Successfully generated types');
    process.exit(0);
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
