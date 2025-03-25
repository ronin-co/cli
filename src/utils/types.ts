import fs from 'node:fs/promises';
import path from 'node:path';

import json5 from 'json5';

/**
 * The name of the TypeScript declaration file stored inside the `.ronin` directory.
 */
export const TYPES_DTS_FILE_NAME = 'types.d.ts';

/**
 * The name of the TypeScript declaration file stored inside the `.ronin` directory.
 */
const TYPES_INCLUDE_PATH = '.ronin/*.d.ts';

/**
 * Add the path to the generated TypeScript types to the `tsconfig.json` file.
 *
 * @returns Promise resolving to void.
 */
export const appendTypesToConfig = async (): Promise<void> => {
  // Set a base TypeScript config used for every project.
  const tsConfigContents = {
    compilerOptions: {},
    include: new Array<string>(),
  };

  // Attempt to load the existing `tsconfig.json` file.
  const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
  const tsConfigExists = await fs.exists(tsconfigPath);
  if (tsConfigExists) {
    const contents = await fs.readFile(tsconfigPath, 'utf-8');
    const json = json5.parse(contents);
    Object.assign(tsConfigContents, json);
  }

  // Add the path to the generated TypeScript types to the `tsconfig.json` file.
  if (!tsConfigContents.include.includes(TYPES_INCLUDE_PATH))
    tsConfigContents.include.push(TYPES_INCLUDE_PATH);

  // Saves the updated `tsconfig.json` file to disk.
  await fs.writeFile(tsconfigPath, JSON.stringify(tsConfigContents, null, 2));
};

/**
 * Generate the TypeScript types for a space.
 *
 * @param appTokenOrSessionToken - Authentication token used to authorize the API request.
 * @param slug - Slug of the space to generate types for.
 *
 * @returns Promise resolving to the generated TypeScript types.
 */
export const getSpaceTypes = async (
  appTokenOrSessionToken: string | undefined,
  slug: string,
): Promise<string> => {
  const url = new URL(`/generate/${slug}`, 'https://codegen.ronin.co/');
  url.searchParams.set('lang', 'typescript');

  const response = await fetch(url.href, {
    headers: {
      Authorization: `Bearer ${appTokenOrSessionToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) throw new Error(`API request failed with status: ${response.status}`);

  const code = await response.text();

  return code;
};
