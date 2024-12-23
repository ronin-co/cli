import fs from 'node:fs';
import path from 'node:path';
import { format } from 'prettier';

/**
 * Detects code formatting configuration from common config files.
 *
 * @returns Object containing detected formatting preferences.
 */
export const detectFormatConfig = (): {
  useTabs: boolean;
  tabWidth: number;
  singleQuote: boolean;
  semi: boolean;
  configSource: string;
} => {
  const configFiles = ['biome.json', '.prettierrc.json', '.eslintrc.json', '.prettierrc'];

  const cwd = process.cwd();

  for (const file of configFiles) {
    const configPath = path.join(cwd, file);

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        if (file === 'biome.json') {
          return {
            useTabs: config.formatter?.indentStyle === 'tab',
            tabWidth: config.formatter?.indentWidth ?? 2,
            singleQuote: config.javascript?.formatter?.quoteStyle === 'single',
            semi: config.javascript?.formatter?.semicolons === 'always',
            configSource: path.basename(file),
          };
        }

        if (file === '.eslintrc.json') {
          return {
            useTabs: config.rules?.indent?.[1] === 'tab',
            tabWidth:
              typeof config.rules?.indent?.[1] === 'number' ? config.rules.indent[1] : 2,
            singleQuote: config.rules?.quotes?.[1] === 'single',
            semi: config.rules?.semi?.[0] === 'error' || config.rules?.semi?.[0] === 2,
            configSource: path.basename(file),
          };
        }

        // For .prettierrc.json
        return {
          useTabs: config.useTabs ?? false,
          tabWidth: config.tabWidth ?? 2,
          singleQuote: config.singleQuote ?? true,
          semi: config.semi ?? true,
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

  return format(code, {
    parser: 'typescript',
    useTabs: config.useTabs,
    tabWidth: config.tabWidth,
    singleQuote: config.singleQuote,
    semi: config.semi,
  });
};
