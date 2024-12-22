import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import { detectFormatConfig, formatCode } from '@/src/utils/format';

describe('format', () => {
  test('detectFormatConfig should return defaults when no config files exist', () => {
    // Mock fs.existsSync to return false for all config files
    const originalExistsSync = fs.existsSync;
    fs.existsSync = (): boolean => false;

    const config = detectFormatConfig();
    expect(config).toEqual({
      useTabs: false,
      tabWidth: 2,
      singleQuote: true,
      semi: true,
      configSource: 'default',
    });

    // Restore original
    fs.existsSync = originalExistsSync;
  });

  test('detectFormatConfig should parse prettier config', () => {
    // Mock fs and path functions
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;

    fs.existsSync = (filePath: fs.PathLike): boolean =>
      filePath.toString().endsWith('.prettierrc');
    // @ts-expect-error Override type
    fs.readFileSync = (_path: fs.PathOrFileDescriptor): string =>
      JSON.stringify({
        useTabs: true,
        tabWidth: 4,
        singleQuote: false,
        semi: false,
      });

    const config = detectFormatConfig();
    expect(config).toEqual({
      useTabs: true,
      tabWidth: 4,
      singleQuote: false,
      semi: false,
      configSource: '.prettierrc',
    });

    // Restore originals
    fs.existsSync = originalExistsSync;
    fs.readFileSync = originalReadFileSync;
  });

  test('detectFormatConfig should parse biome config', () => {
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;

    fs.existsSync = (filePath: fs.PathLike): boolean =>
      filePath.toString().endsWith('biome.json');
    // @ts-expect-error Override type
    fs.readFileSync = (_path: fs.PathOrFileDescriptor): string =>
      JSON.stringify({
        indent: {
          style: 'tab',
          size: 3,
        },
        style: {
          quotes: 'single',
          semicolons: false,
        },
      });

    const config = detectFormatConfig();
    expect(config).toEqual({
      useTabs: true,
      tabWidth: 3,
      singleQuote: true,
      semi: false,
      configSource: 'biome.json',
    });

    // Restore originals
    fs.existsSync = originalExistsSync;
    fs.readFileSync = originalReadFileSync;
  });

  test('formatCode should format code according to config', async () => {
    const input = "function test(){return 'hello'}";
    const formatted = await formatCode(input);
    expect(formatted).toContain('function test()');
    expect(formatted).toContain(';');
  });

  test('detectFormatConfig should handle broken config files', () => {
    // Mock fs functions
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;
    const originalConsoleLog = console.log;

    let loggedMessage = '';
    console.log = (msg: string): void => {
      loggedMessage = msg;
    };

    fs.existsSync = (filePath: fs.PathLike): boolean =>
      filePath.toString().endsWith('.prettierrc');
    // @ts-expect-error Override type
    fs.readFileSync = (_path: fs.PathOrFileDescriptor): string =>
      '{ this is not valid JSON }';

    const config = detectFormatConfig();

    // Should fall back to defaults when config is broken
    expect(config).toEqual({
      useTabs: false,
      tabWidth: 2,
      singleQuote: true,
      semi: true,
      configSource: 'default',
    });

    // Should log error about broken config
    expect(loggedMessage).toContain('Error parsing .prettierrc:');

    // Restore originals
    fs.existsSync = originalExistsSync;
    fs.readFileSync = originalReadFileSync;
    console.log = originalConsoleLog;
  });
});
