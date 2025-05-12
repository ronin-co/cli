import fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test';

import * as typesModule from '@/src/utils/types';

describe('types utils', () => {
  beforeEach(() => {
    // Reset all mocks before each test.
    jest.restoreAllMocks();
  });

  afterEach(() => {
    // Restore original fetch.
    jest.restoreAllMocks();
  });

  describe('injectTSConfigInclude', () => {
    test('should create a config from scratch', async () => {
      spyOn(fs, 'exists').mockReturnValue(Promise.resolve(false));

      const config = await typesModule.injectTSConfigInclude('fake-path');

      expect(config).toMatchObject({
        compilerOptions: {},
        include: ['**/*.ts', '**/*.tsx', '.ronin/*.d.ts'],
      });
    });

    test('should add an `include` array', async () => {
      spyOn(fs, 'exists').mockReturnValue(Promise.resolve(true));
      spyOn(fs, 'readFile').mockReturnValue(
        Promise.resolve(
          JSON.stringify({
            compilerOptions: {},
          }),
        ),
      );

      const config = await typesModule.injectTSConfigInclude('fake-path');

      expect(config).toMatchObject({
        compilerOptions: {},
        include: ['**/*.ts', '**/*.tsx', '.ronin/*.d.ts'],
      });
    });

    test('should extend a populated `include` array', async () => {
      spyOn(fs, 'exists').mockReturnValue(Promise.resolve(true));
      spyOn(fs, 'readFile').mockReturnValue(
        Promise.resolve(
          JSON.stringify({
            compilerOptions: {},
            include: ['src/**/*'],
          }),
        ),
      );

      const config = await typesModule.injectTSConfigInclude('fake-path');

      expect(config).toMatchObject({
        compilerOptions: {},
        include: ['src/**/*', '.ronin/*.d.ts'],
      });
    });

    test('should extend an empty `include` array', async () => {
      spyOn(fs, 'exists').mockReturnValue(Promise.resolve(true));
      spyOn(fs, 'readFile').mockReturnValue(
        Promise.resolve(
          JSON.stringify({
            compilerOptions: {},
            include: [],
          }),
        ),
      );

      const config = await typesModule.injectTSConfigInclude('fake-path');

      expect(config).toMatchObject({
        compilerOptions: {},
        include: ['**/*.ts', '**/*.tsx', '.ronin/*.d.ts'],
      });
    });
  });

  describe('getSpaceTypes', () => {
    test('should fetch and return types successfully', async () => {
      const mockSpaceId = '123';

      // Mock fetch response.
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(''),
        } as Response),
      );

      const result = await typesModule.getSpaceTypes('test-token', mockSpaceId);

      expect(result).toEqual('');
      expect(fetchSpy).toHaveBeenCalledWith(
        `https://codegen.ronin.co/generate/${mockSpaceId}?language=typescript`,
        {
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        },
      );

      fetchSpy.mockRestore();
    });

    test('should throw error when API request fails', async () => {
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        } as Response),
      );

      await expect(
        typesModule.getSpaceTypes('test-token', 'mock-space-id'),
      ).rejects.toThrow('API request failed with status: 500');

      fetchSpy.mockRestore();
    });
  });

  describe('getZodSchemas', () => {
    test('should fetch and return zod schemas successfully', async () => {
      const mockSpaceId = '123';

      // Mock fetch response.
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(''),
        } as Response),
      );

      const result = await typesModule.getZodSchemas('test-token', mockSpaceId);

      expect(result).toEqual('');
      expect(fetchSpy).toHaveBeenCalledWith(
        `https://codegen.ronin.co/generate/${mockSpaceId}?language=zod`,
        {
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        },
      );

      fetchSpy.mockRestore();
    });

    test('should throw error when API request fails', async () => {
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        } as Response),
      );

      await expect(
        typesModule.getZodSchemas('test-token', 'mock-space-id'),
      ).rejects.toThrow('API request failed with status: 500');

      fetchSpy.mockRestore();
    });
  });
});
