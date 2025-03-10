import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test';
import * as configModule from '@/src/utils/config';
import * as selectModule from '@inquirer/prompts';

import { getOrSelectSpaceId, getSpaces } from '@/src/utils/space';

describe('space utils', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.restoreAllMocks();
  });

  afterEach(() => {
    // Restore original fetch
    jest.restoreAllMocks();
  });

  describe('getSpaces', () => {
    test('should fetch and return spaces successfully', async () => {
      const mockSpaces = [{ id: '123', handle: 'test-space', name: 'Test Space' }];

      // Mock fetch response
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [[{ space: mockSpaces[0] }]],
            }),
        } as Response),
      );

      const result = await getSpaces('test-token');
      expect(result).toEqual(mockSpaces);
      expect(fetchSpy).toHaveBeenCalledWith('https://ronin.co/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'token=test-token',
        },
        body: JSON.stringify({
          queries: [
            {
              get: {
                members: {
                  using: ['space', 'account'],
                  with: {
                    team: null,
                  },
                },
              },
            },
          ],
        }),
      });

      fetchSpy.mockRestore();
    });

    test('should throw error when API request fails', async () => {
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        } as Response),
      );

      await expect(getSpaces('test-token')).rejects.toThrow(
        'Failed to fetch available spaces: API request failed with status: 500',
      );

      fetchSpy.mockRestore();
    });

    test('should throw error when API returns error message', async () => {
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              error: 'API Error',
            }),
        } as Response),
      );

      await expect(getSpaces('test-token')).rejects.toThrow(
        'Failed to fetch available spaces: API Error',
      );

      fetchSpy.mockRestore();
    });
  });

  describe('getOrSelectSpaceId', () => {
    test('should return existing space from config', async () => {
      const readConfigSpy = spyOn(configModule, 'readConfig').mockImplementation(() => ({
        space: 'existing-space',
      }));
      const saveConfigSpy = spyOn(configModule, 'saveConfig');

      const result = await getOrSelectSpaceId();
      expect(result).toBe('existing-space');

      readConfigSpy.mockRestore();
      saveConfigSpy.mockRestore();
    });

    test('should auto-select space when only one available', async () => {
      const readConfigSpy = spyOn(configModule, 'readConfig').mockImplementation(() => ({
        space: undefined,
      }));
      const saveConfigSpy = spyOn(configModule, 'saveConfig');

      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                [{ space: { id: 'single-space', handle: 'test', name: 'Test' } }],
              ],
            }),
        } as Response),
      );

      const result = await getOrSelectSpaceId('test-token');
      expect(result).toBe('single-space');
      expect(saveConfigSpy).toHaveBeenCalledWith({ space: 'single-space' });

      readConfigSpy.mockRestore();
      saveConfigSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    test('should prompt user to select space when multiple available', async () => {
      const readConfigSpy = spyOn(configModule, 'readConfig').mockImplementation(() => ({
        space: undefined,
      }));
      const saveConfigSpy = spyOn(configModule, 'saveConfig');

      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                [
                  { space: { id: 'space-1', handle: 'test-1', name: 'Test 1' } },
                  { space: { id: 'space-2', handle: 'test-2', name: 'Test 2' } },
                ],
              ],
            }),
        } as Response),
      );
      const selectSpy = spyOn(selectModule, 'select').mockResolvedValue('space-2');

      const result = await getOrSelectSpaceId('test-token');
      expect(result).toBe('space-2');
      expect(saveConfigSpy).toHaveBeenCalledWith({ space: 'space-2' });

      readConfigSpy.mockRestore();
      saveConfigSpy.mockRestore();
      fetchSpy.mockRestore();
      selectSpy.mockRestore();
    });

    test('should throw error when no spaces available', async () => {
      const readConfigSpy = spyOn(configModule, 'readConfig').mockImplementation(() => ({
        space: undefined,
      }));
      const saveConfigSpy = spyOn(configModule, 'saveConfig');

      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [[]],
            }),
        } as Response),
      );

      await expect(getOrSelectSpaceId('test-token')).rejects.toThrow(
        "You don't have access to any space or your CLI session is invalid",
      );

      readConfigSpy.mockRestore();
      saveConfigSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    test('should throw error when space is not specified', async () => {
      const readConfigSpy = spyOn(configModule, 'readConfig').mockImplementation(() => ({
        space: undefined,
      }));
      const saveConfigSpy = spyOn(configModule, 'saveConfig');

      await expect(getOrSelectSpaceId()).rejects.toThrow('Space ID is not specified');

      readConfigSpy.mockRestore();
      saveConfigSpy.mockRestore();
    });
  });
});
