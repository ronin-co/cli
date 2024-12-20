import fs from 'node:fs';
import path from 'node:path';
import { format } from 'prettier';

/**
 * Detects code formatting configuration from common config files
 *
 * @returns Object containing detected formatting preferences
 */
export const detectFormatConfig = (): {
  useTabs: boolean;
  tabWidth: number;
  singleQuote: boolean;
  semi: boolean;
  configSource: string;
} => {
  const configFiles = [
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.js',
    '.eslintrc',
    '.eslintrc.json',
    '.eslintrc.js',
    'biome.json',
  ];

  const cwd = process.cwd();

  for (const file of configFiles) {
    const configPath = path.join(cwd, file);

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        return {
          useTabs: config.useTabs ?? config.indent?.style === 'tab',
          tabWidth: config.tabWidth ?? config.indent?.size ?? 2,
          singleQuote: config.singleQuote ?? config.style?.quotes === 'single',
          semi: config.semi ?? config.style?.semicolons !== false,
          configSource: path.basename(file),
        };
      } catch (err) {
        console.log(`Error parsing ${file}: ${err}`);
      }
    }
  }

  // Return defaults if no config found
  return {
    useTabs: false,
    tabWidth: 2,
    singleQuote: true,
    semi: true,
    configSource: 'default',
  };
};

export const formatCode = async (code: string): Promise<string> => {
  const config = detectFormatConfig();
  console.log(config);
  return await format(code, {
    parser: 'typescript',
    useTabs: config.useTabs,
    tabWidth: config.tabWidth,
    singleQuote: config.singleQuote,
    semi: config.semi,
  });
};
