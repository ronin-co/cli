import fs from 'node:fs/promises';

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
 * @param path - Path to the `tsconfig.json` file.
 *
 * @returns Promise resolving to void.
 */
export const injectTSConfigInclude = async (
  path: string,
): Promise<{
  compilerOptions: Record<string, unknown>;
  include: Array<string>;
}> => {
  // Set a base TypeScript config used for every project.
  const contents = {
    compilerOptions: {},
    include: new Array<string>(),
  };

  // Attempt to load the existing `tsconfig.json` file.
  const fileExists = await fs.exists(path);
  if (fileExists) {
    const fileContents = await fs.readFile(path, 'utf-8');
    const json = json5.parse(fileContents);
    Object.assign(contents, json);
  }

  // Add the path to the generated TypeScript types to the `tsconfig.json` file.
  if (!contents.include.includes(TYPES_INCLUDE_PATH))
    contents.include.push(TYPES_INCLUDE_PATH);

  return contents;
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
