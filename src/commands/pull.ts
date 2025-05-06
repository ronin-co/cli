import * as fs from 'node:fs/promises';
import { confirm } from '@inquirer/prompts';

import { formatCode } from '@/src/utils/format';
import {
  type LocalPackages,
  MODEL_IN_CODE_PATH,
  getLocalPackages,
} from '@/src/utils/misc';
import { getModels } from '@/src/utils/model';
import { spinner as ora } from '@/src/utils/spinner';

/**
 * Pulls models from RONIN schema into model definitions file.
 *
 * @param appToken - The app token to use.
 * @param sessionToken - The session token to use.
 * @param local - Whether to pull models from the local database.
 */
export default async (
  appToken?: string,
  sessionToken?: string,
  local?: boolean,
): Promise<void> => {
  const spinner = ora.start('Pulling models');
  const packages = await getLocalPackages();

  try {
    // Get models from RONIN schema.
    const modelDefinitions = await getModelDefinitionsFileContent(packages, {
      appToken,
      sessionToken,
      local,
    });

    if (!modelDefinitions) {
      spinner.fail('No models found. Start defining models in your code.');
      process.exit(1);
    }

    if ((await fs.exists(MODEL_IN_CODE_PATH)) && modelDefinitions) {
      if (
        JSON.stringify(modelDefinitions) ===
        JSON.stringify(await fs.readFile(MODEL_IN_CODE_PATH, 'utf-8'))
      ) {
        spinner.succeed('Your model definitions are up to date.');
        return;
      }

      spinner.stop();
      const overwrite = await confirm({
        message: 'A model definition file already exists. Do you want to overwrite it?',
      });
      spinner.start();

      if (!overwrite) {
        return;
      }
    }

    await fs.writeFile(MODEL_IN_CODE_PATH, modelDefinitions);
    spinner.succeed('Models pulled');
  } catch {
    spinner.fail('Failed to pull models');
    process.exit(1);
  }
};

export const getModelDefinitionsFileContent = async (
  packages: LocalPackages,
  options?: {
    appToken?: string;
    sessionToken?: string;
    local?: boolean;
  },
): Promise<string | null> => {
  const models = await getModels(packages, {
    token: options?.appToken || options?.sessionToken,
    isLocal: options?.local,
  });

  if (models.length === 0) {
    return null;
  }

  const primitives = [
    ...new Set(models.flatMap((model) => model.fields.map((field) => field.type))),
  ];
  const importStatements = `import { model, ${primitives.join(',')} } from "ronin/schema";`;

  const modelDefinitions = models.map((model) => {
    const { fields, indexes, ...rest } = model;

    const fieldsDefinition = fields
      .map((field) => {
        const { slug, type, ...rest } = field;

        return `${slug}: ${type}(${Object.keys(rest).length === 0 ? '' : JSON.stringify(rest)})`;
      })
      .join(',\n');

    return `export const ${capitalize(model.slug)} = model({
        ${JSON.stringify(rest).slice(1, -1)},
        ${
          fieldsDefinition
            ? `fields: {
            ${fieldsDefinition}
        },`
            : ''
        }
        ${indexes ? `indexes: ${JSON.stringify(indexes)}` : ''}
    });`;
  });

  return formatCode(`${importStatements}
    
    ${modelDefinitions.join('\n\n')}
  `);
};

const capitalize = (val: string): string => {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
};
