import { describe, expect, spyOn, test } from 'bun:test';
import diff from '@/src/commands/diff';

describe('diff', () => {
  test('run diff command with non existing path to models', async () => {
    // @ts-ignore This is just a mock!
    // biome-ignore lint/suspicious/noEmptyBlockStatements: This is just a mock!
    spyOn(process, 'exit').mockImplementation(() => {});

    try {
      // @ts-ignore This is just a mock!
      await diff('appToken', 'sessionToken', { local: true }, ['diff', 'path/to/models']);
    } catch (err) {
      expect(err).toThrowError();
    }
  });

  test('run diff command with no models file', async () => {
    // @ts-ignore This is just a mock!
    // biome-ignore lint/suspicious/noEmptyBlockStatements: This is just a mock!
    spyOn(process, 'exit').mockImplementation(() => {});

    try {
      // @ts-ignore This is just a mock!
      await diff('appToken', 'sessionToken', { local: true }, ['diff']);
    } catch (err) {
      expect(err).toThrowError();
    }
  });
});
