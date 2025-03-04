import {
  type Mock,
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from 'bun:test';
import { jest } from 'bun:test';
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import * as initModule from '@/src/commands/init';
import * as loginModule from '@/src/commands/login';
import { run } from '@/src/index';
import * as infoModule from '@/src/utils/info';
import * as miscModule from '@/src/utils/misc';
import * as modelModule from '@/src/utils/model';
import { convertObjectToArray } from '@/src/utils/model';
import * as sessionModule from '@/src/utils/session';
import * as spaceModule from '@/src/utils/space';
import * as selectModule from '@inquirer/prompts';
import * as getPort from 'get-port';
import * as open from 'open';

describe('CLI', () => {
  // Store original values
  const originalIsTTY = process.stdout.isTTY;
  const expectedHelpText =
    '\n  \u001b[1m\u001b[35mronin\u001b[39m\u001b[22m — Data at the edge\n\n  \u001b[1mUSAGE\u001b[22m\n\n      \u001b[1m$\u001b[22m \u001b[1m\u001b[35mronin\u001b[39m\u001b[22m\n      \u001b[1m$\u001b[22m \u001b[1m\u001b[35mronin\u001b[39m\u001b[22m login\n      \u001b[1m$\u001b[22m \u001b[1m\u001b[35mronin\u001b[39m\u001b[22m --help\n      \u001b[1m$\u001b[22m \u001b[1m\u001b[35mronin\u001b[39m\u001b[22m --version\n\n  \u001b[1mCOMMANDS\u001b[22m\n\n      login                               Authenticate with RONIN (run by default for every command)\n      init [space]                        Initialize the TypeScript types for a given space\n      diff                                Compare the database schema with the local schema and create a patch\n      apply                               Apply the most recent patch to the database\n\n  \u001b[1mOPTIONS\u001b[22m\n\n      -h, --help                          Shows this help message\n      -v, --version                       Shows the version of the CLI that is currently installed\n      -d, --debug                         Shows additional debugging information\n  ';

  let stdoutSpy: Mock<typeof console.log>;
  let stderrSpy: Mock<typeof process.stderr.write>;
  let exitSpy: Mock<typeof process.exit>;

  beforeEach(() => {
    // Spy on stdout/stderr
    stdoutSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = spyOn(process, 'exit').mockImplementation(() => undefined as never);
    spyOn(console, 'table').mockImplementation(() => {});

    // Prevent actually reading/writing files
    // @ts-expect-error This is a mock
    spyOn(fs, 'readdirSync').mockReturnValue(['migration-0001.ts', 'migration-0002.ts']);
    spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    spyOn(fs, 'mkdirSync').mockImplementation(() => {});
  });

  afterEach(() => {
    process.stdout.isTTY = originalIsTTY;
    delete process.env.RONIN_TOKEN;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('misc', () => {
    test('should break arg parse', async () => {
      process.argv = ['bun', 'ronin', '--invalid-flag'];
      const exitSpy = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await run({ version: '1.0.0' });
      } catch {
        expect(stderrSpy.mock.calls[3][0]).toContain("Unknown option '--invalid-flag'");
        expect(exitSpy).toHaveBeenCalledWith(1);
      }
    });

    test('should handle SIGINT gracefully', async () => {
      process.argv = ['bun', 'ronin'];
      const exitSpy = spyOn(process, 'exit').mockImplementation(() => 'Exited' as never);

      try {
        const runPromise = run({ version: '1.0.0' });
        process.emit('SIGINT');
        await runPromise;
      } catch {
        expect(exitSpy).toHaveBeenCalledWith(1);
      }
    });

    test('should handle SIGTERM gracefully', async () => {
      process.argv = ['bun', 'ronin'];
      const exitSpy = spyOn(process, 'exit').mockImplementation(() => 'Exited' as never);

      try {
        const runPromise = run({ version: '1.0.0' });
        process.emit('SIGTERM');
        await runPromise;
      } catch {
        expect(exitSpy).toHaveBeenCalledWith(1);
      }
    });

    test('should exit when running in non-interactive shell without app token', async () => {
      process.argv = ['bun', 'ronin'];
      process.stdout.isTTY = false;
      const exitSpy = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      spyOn(sessionModule, 'getSession').mockResolvedValue(null);

      try {
        await run({ version: '1.0.0' });
      } catch {
        expect(exitSpy).toHaveBeenCalledWith(1);
      }
    });
  });

  describe('help', () => {
    test('should print help when --help flag is provided', async () => {
      process.argv = ['bun', 'ronin', '--help'];
      const helpSpy = spyOn(infoModule, 'printHelp');

      await run({ version: '1.0.0' });

      expect(helpSpy).toHaveBeenCalled();
      expect(stdoutSpy.mock.calls[0][0]).toContain(expectedHelpText);
    });

    test('should print version when --version flag is provided', async () => {
      process.argv = ['bun', 'ronin', '--version'];
      const versionSpy = spyOn(infoModule, 'printVersion');

      await run({ version: '1.0.0' });

      expect(stdoutSpy).toHaveBeenCalledWith('1.0.0');
      expect(versionSpy).toHaveBeenCalledWith('1.0.0');
    });

    test('should print help when no command is provided', async () => {
      process.argv = ['bun', 'ronin'];
      const helpSpy = spyOn(infoModule, 'printHelp');

      await run({ version: '1.0.0' });

      expect(helpSpy).toHaveBeenCalled();
      expect(stdoutSpy.mock.calls[0][0]).toContain(expectedHelpText);
    });
  });

  describe('starter', () => {
    describe('login', () => {
      test('should login when no token is provided', async () => {
        process.argv = ['bun', 'ronin', 'login'];
        const mockPort = 12345;

        spyOn(getPort, 'default').mockResolvedValue(mockPort);

        // Mock HTTP server
        const mockServer = {
          listen: () => mockServer,
          once: (
            event: string,
            callback: (req: http.IncomingMessage, res: http.ServerResponse) => void,
          ) => {
            if (event === 'request') {
              setTimeout(() => {
                callback(
                  { url: '/?token=Bulgur' } as http.IncomingMessage,
                  {
                    setHeader: () => {},
                    writeHead: () => ({ end: () => {} }),
                    end: () => {},
                  } as unknown as http.ServerResponse,
                );
              }, 10);
            }
            return mockServer;
          },
          close: () => {},
        };
        spyOn(http, 'createServer').mockReturnValue(mockServer as unknown as http.Server);
        spyOn(open, 'default').mockResolvedValue({} as unknown as ChildProcess);

        // Spy on session storage
        const storeSessionSpy = spyOn(sessionModule, 'storeSession');
        const storeTokenForNPMSpy = spyOn(sessionModule, 'storeTokenForNPM');
        const storeTokenForBunSpy = spyOn(sessionModule, 'storeTokenForBun');
        const writeFileSpy = spyOn(fs.promises, 'writeFile').mockResolvedValue();

        await run({ version: '1.0.0' });

        // Verify token storage
        expect(storeSessionSpy).toHaveBeenCalledWith('Bulgur');
        expect(storeTokenForNPMSpy).toHaveBeenCalledWith('Bulgur');
        expect(storeTokenForBunSpy).toHaveBeenCalledWith('Bulgur');

        // Verify file contents
        expect(writeFileSpy.mock.calls[0][1]).toContain(
          JSON.stringify({ token: 'Bulgur' }, null, 2),
        );
        expect(writeFileSpy.mock.calls[1][1]).toContain(
          'https://ronin.supply\n//ronin.supply/:_authToken=Bulgur',
        );
        expect(writeFileSpy.mock.calls[2][1]).toContain('token = "Bulgur"');
        expect(exitSpy).toHaveBeenCalledWith(0);
      });

      test('should login when a token is provided', async () => {
        process.env.RONIN_TOKEN = 'Peaches';
        process.argv = ['bun', 'ronin', 'login'];

        // Mock file operations
        spyOn(fs.promises, 'writeFile').mockResolvedValue();
        spyOn(fs.promises, 'stat').mockResolvedValue({} as fs.Stats);

        // Spy on session storage
        const storeSessionSpy = spyOn(sessionModule, 'storeSession');
        const storeTokenForNPMSpy = spyOn(sessionModule, 'storeTokenForNPM');
        const storeTokenForBunSpy = spyOn(sessionModule, 'storeTokenForBun');
        const loginSpy = spyOn(loginModule, 'default');

        await run({ version: '1.0.0' });

        expect(loginSpy).toHaveBeenCalledWith('Peaches');
        expect(storeSessionSpy).not.toHaveBeenCalled();
        expect(storeTokenForNPMSpy).toHaveBeenCalledWith('Peaches');
        expect(storeTokenForBunSpy).toHaveBeenCalledWith('Peaches');
      });
    });

    describe('init', () => {
      test('should fail if no space handle is provided', async () => {
        process.argv = ['bun', 'ronin', 'init'];

        try {
          await run({ version: '1.0.0' });
        } catch (error) {
          expect((error as Error).message).toBe('process.exit called');
          expect(exitSpy).toHaveBeenCalledWith(1);
          expect(stderrSpy.mock.calls[0][0]).toEqual('Initializing project');
          expect(stderrSpy.mock.calls[7][0]).toContain(
            'Please provide a space handle like this:',
          );
        }
      });

      test('should fail if no package.json is found', async () => {
        process.argv = ['bun', 'ronin', 'init', 'my-space'];
        spyOn(fs.promises, 'access').mockImplementation(() => Promise.reject());

        try {
          await run({ version: '1.0.0' });
        } catch (error) {
          expect((error as Error).message).toBe('process.exit called');
          expect(exitSpy).toHaveBeenCalledWith(1);
          expect(stderrSpy.mock.calls[7][0]).toContain('No `package.json` found');
        }
      });

      const setupInitTest = (hasBun = true) => {
        process.argv = ['bun', 'ronin', 'init', 'test-space'];

        // Mock file existence checks
        spyOn(fs.promises, 'access').mockImplementation((path) => {
          if (
            path.toString().includes('package.json') ||
            (hasBun && path.toString().includes('bun.lockb')) ||
            path.toString().includes('.gitignore') ||
            path.toString().includes('tsconfig.json')
          ) {
            return Promise.resolve();
          }
          return Promise.reject(new Error('File not found'));
        });

        // Mock file operations
        // @ts-expect-error This is a mock
        spyOn(fs.promises, 'readFile').mockImplementation((path) => {
          if (path.toString().includes('.gitignore'))
            return Promise.resolve('node_modules\n');
          if (path.toString().includes('tsconfig.json'))
            return Promise.resolve('{"compilerOptions":{"types":[]}}');
          return Promise.resolve('{"token": "Bulgur"}');
        });
        spyOn(fs.promises, 'appendFile').mockResolvedValue();
        spyOn(fs.promises, 'writeFile').mockResolvedValue();

        // Mock exec
        spyOn(initModule, 'exec').mockImplementation(
          // @ts-expect-error This is a mock
          () => () => Promise.resolve({ stdout: '', stderr: '' }),
        );
      };

      test('should successfully initialize a project with Bun', async () => {
        setupInitTest(true);
        await run({ version: '1.0.0' });
        expect(initModule.exec).toHaveBeenCalledWith(
          'bun add @ronin-types/test-space --dev',
        );
      });

      test('should successfully initialize a project with npm', async () => {
        setupInitTest(false);
        await run({ version: '1.0.0' });
        expect(initModule.exec).toHaveBeenCalledWith(
          'npm install @ronin-types/test-space --save-dev',
        );
      });

      test('should fail to initialize a project with unauthorized access', async () => {
        setupInitTest();

        // Mock exec to throw unauthorized error
        spyOn(initModule, 'exec').mockImplementation(() => {
          throw new Error('401 Unauthorized');
        });

        await run({ version: '1.0.0' });
        expect(stderrSpy.mock.calls[7][0]).toContain(
          'You are not a member of the "test-space" space',
        );
      });

      test('diff and apply', async () => {
        process.argv = ['bun', 'ronin', 'diff', '--apply'];

        // Mock space selection and models
        spyOn(spaceModule, 'getOrSelectSpaceId').mockResolvedValue('test-space');
        spyOn(modelModule, 'getModels').mockResolvedValue([
          {
            slug: 'user',
            // @ts-expect-error This is a mock
            fields: [{ type: 'string', slug: 'name' }],
          },
        ]);
        spyOn(miscModule, 'getModelDefinitions').mockResolvedValue([
          {
            slug: 'user',
            fields: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
          },
        ]);

        // Mock file operations
        spyOn(fs, 'existsSync').mockImplementation(
          (path) => !path.toString().includes('.ronin/db.sqlite'),
        );
        spyOn(path, 'resolve').mockReturnValue(
          path.join(process.cwd(), 'tests/fixtures/migration-fixture.ts'),
        );

        // Mock fetch
        spyOn(global, 'fetch').mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);

        await run({ version: '1.0.0' });

        expect(stderrSpy.mock.calls[4][0]).toContain('Comparing models');
        expect(stderrSpy.mock.calls[8][0]).toContain(
          'Successfully generated migration protocol file',
        );
        expect(stderrSpy.mock.calls[17][0]).toContain('Successfully applied migration');
      });
    });
  });

  describe('migration', () => {
    // Common migration test setup
    const setupMigrationTest = () => {
      spyOn(spaceModule, 'getOrSelectSpaceId').mockResolvedValue('test-space');
      spyOn(modelModule, 'getModels').mockResolvedValue([
        {
          slug: 'user',
          // @ts-expect-error This is a mock
          fields: convertObjectToArray({
            name: { type: 'string' },
          }),
        },
      ]);
      spyOn(miscModule, 'getModelDefinitions').mockResolvedValue([
        {
          slug: 'user',
          fields: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
      ]);
      spyOn(fs, 'existsSync').mockImplementation(
        (path) => !path.toString().includes('.ronin/db.sqlite'),
      );
      spyOn(path, 'resolve').mockReturnValue(
        path.join(process.cwd(), 'tests/fixtures/migration-fixture.ts'),
      );
    };

    describe('diff', () => {
      test('should fail if no schema file is provided', async () => {
        process.argv = ['bun', 'ronin', 'diff'];
        spyOn(spaceModule, 'getOrSelectSpaceId').mockResolvedValue('test-space');

        await run({ version: '1.0.0' });

        expect(stderrSpy.mock.calls[2][0]).toContain(
          'Could not find a model definition file',
        );
        expect(stderrSpy.mock.calls[8][0]).toContain(
          "Cannot find module 'schema/index.ts'",
        );
      });

      test('no changes detected', async () => {
        process.argv = ['bun', 'ronin', 'diff', '--debug'];
        spyOn(spaceModule, 'getOrSelectSpaceId').mockResolvedValue('test-space');

        // Mock identical models (no changes)
        spyOn(modelModule, 'getModels').mockResolvedValue([
          {
            slug: 'user',
            fields: {
              name: { type: 'string' },
            },
          },
        ]);
        spyOn(miscModule, 'getModelDefinitions').mockResolvedValue([
          {
            slug: 'user',
            fields: {
              name: { type: 'string' },
            },
          },
        ]);
        spyOn(fs, 'existsSync').mockReturnValue(false);

        await run({ version: '1.0.0' });

        expect(stderrSpy.mock.calls[4][0]).toContain('Comparing models');
        expect(stderrSpy.mock.calls[8][0]).toContain('No changes detected');
      });

      test('changes detected', async () => {
        process.argv = ['bun', 'ronin', 'diff', '--sql'];
        setupMigrationTest();

        await run({ version: '1.0.0' });

        expect(stderrSpy.mock.calls[4][0]).toContain('Comparing models');
        expect(stderrSpy.mock.calls[8][0]).toContain(
          'Successfully generated migration protocol file',
        );
      });

      test('diff with apply flag', async () => {
        process.argv = ['bun', 'ronin', 'diff', '--apply'];
        setupMigrationTest();

        // Mock fetch
        spyOn(global, 'fetch').mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);

        await run({ version: '1.0.0' });

        expect(stderrSpy.mock.calls[4][0]).toContain('Comparing models');
        expect(stderrSpy.mock.calls[8][0]).toContain(
          'Successfully generated migration protocol file',
        );
        expect(stderrSpy.mock.calls[17][0]).toContain('Successfully applied migration');
      });

      test('diff with local flag', async () => {
        process.argv = ['bun', 'ronin', 'diff', '--local'];
        setupMigrationTest();

        await run({ version: '1.0.0' });

        expect(stderrSpy.mock.calls[4][0]).toContain('Comparing models');
        expect(stderrSpy.mock.calls[8][0]).toContain(
          'Successfully generated migration protocol file',
        );
      });

      test('diff with multiple flags', async () => {
        process.argv = ['bun', 'ronin', 'diff', '--local', '--apply'];
        setupMigrationTest();

        // Mock fetch
        spyOn(global, 'fetch').mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);

        await run({ version: '1.0.0' });

        expect(stderrSpy.mock.calls[4][0]).toContain('Comparing models');
        expect(stderrSpy.mock.calls[8][0]).toContain(
          'Successfully generated migration protocol file',
        );
        expect(stderrSpy.mock.calls[17][0]).toContain('Successfully applied migration');
      });
    });

    describe('apply', () => {
      test('no access to requested space', async () => {
        process.argv = ['bun', 'ronin', 'apply'];
        spyOn(spaceModule, 'getOrSelectSpaceId').mockResolvedValue('test-space');

        await run({ version: '1.0.0' });

        expect(stderrSpy.mock.calls[5][0]).toContain('Failed to apply migration');
        expect(stderrSpy.mock.calls[8][0]).toContain(
          'This session does not have access to the requested space',
        );
      });

      test('apply migration', async () => {
        process.argv = ['bun', 'ronin', 'apply'];

        spyOn(spaceModule, 'getOrSelectSpaceId').mockResolvedValue('test-space');
        spyOn(modelModule, 'getModels').mockResolvedValue([
          {
            slug: 'user',
            // @ts-expect-error This is a mock
            fields: convertObjectToArray({
              name: { type: 'string' },
            }),
          },
        ]);

        spyOn(fs, 'existsSync').mockImplementation((path) =>
          path.toString().includes('migration-fixture.ts'),
        );
        spyOn(selectModule, 'select').mockResolvedValue('migration-0001.ts');
        spyOn(path, 'resolve').mockReturnValue(
          path.join(process.cwd(), 'tests/fixtures/migration-fixture.ts'),
        );

        await run({ version: '1.0.0' });

        expect(stderrSpy.mock.calls[8][0]).toContain('Failed to apply migration');
        expect(stderrSpy.mock.calls[11][0]).toContain(
          'This session does not have access to the requested space',
        );
      });

      test('should handle network errors when applying migration', async () => {
        process.argv = ['bun', 'ronin', 'apply'];

        spyOn(spaceModule, 'getOrSelectSpaceId').mockResolvedValue('test-space');
        spyOn(global, 'fetch').mockImplementation(() => {
          throw new Error('Network error');
        });

        await run({ version: '1.0.0' });

        expect(
          // @ts-expect-error This is a mock
          stderrSpy.mock.calls.some((call) => call[0].includes('Network error')),
        ).toBe(true);
      });

      test('apply with local flag', async () => {
        process.argv = ['bun', 'ronin', 'apply', '--local'];

        spyOn(spaceModule, 'getOrSelectSpaceId').mockResolvedValue('test-space');
        spyOn(modelModule, 'getModels').mockResolvedValue([
          {
            slug: 'user',
            // @ts-expect-error This is a mock
            fields: convertObjectToArray({
              name: { type: 'string' },
            }),
          },
        ]);

        spyOn(fs, 'existsSync').mockImplementation((path) =>
          path.toString().includes('migration-fixture.ts'),
        );
        spyOn(selectModule, 'select').mockResolvedValue('migration-0001.ts');
        spyOn(path, 'resolve').mockReturnValue(
          path.join(process.cwd(), 'tests/fixtures/migration-fixture.ts'),
        );

        await run({ version: '1.0.0' });

        expect(stderrSpy.mock.calls[5][0]).toContain(
          'Applying migration to local database',
        );
        expect(stderrSpy.mock.calls[8][0]).toContain('Successfully applied migration');
      });

      test('try to apply with non-existent migration file', async () => {
        process.argv = ['bun', 'ronin', 'apply'];

        spyOn(spaceModule, 'getOrSelectSpaceId').mockResolvedValue('test-space');
        spyOn(fs, 'existsSync').mockReturnValue(false);

        spyOn(fs, 'readdirSync').mockReturnValue([]);
        spyOn(modelModule, 'getModels').mockResolvedValue([
          {
            slug: 'user',
            // @ts-expect-error This is a mock
            fields: [{ type: 'string', slug: 'name' }],
          },
        ]);

        await run({ version: '1.0.0' });

        console.error(stderrSpy.mock.calls);

        expect(stderrSpy.mock.calls[5][0]).toContain('Failed to apply migration');
        expect(stderrSpy.mock.calls[8][0]).toContain(
          'No migration files found - Run `ronin diff',
        );
      });
    });
  });
});
