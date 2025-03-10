import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { $ } from 'bun';

describe('CLI Integration Tests', () => {
  let tempDir: string;
  let originalDir: string;
  const CLI_PATH = path.resolve(process.cwd(), 'tests/fixtures/cli.ts');

  beforeEach(async () => {
    // Save original directory to return to it later
    originalDir = process.cwd();

    // Create a temporary directory for testing
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ronin-cli-test-'));

    // Change to the temporary directory
    process.chdir(tempDir);

    // Create a minimal package.json
    await fs.promises.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2),
    );
  });

  afterEach(async () => {
    // Change back to the original directory before cleaning up
    process.chdir(originalDir);

    // Clean up the temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  test('should show help text when run without arguments', async () => {
    // Set environment variables for non-interactive testing
    process.env.RONIN_TOKEN = 'test-token';

    const { stdout, stderr, exitCode } = await $`bun ${CLI_PATH}`.nothrow().quiet();

    console.log(stderr.toString());
    console.log(stdout.toString());

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toContain('Data at the edge');
  });

  test('should show version when run with --version flag', async () => {
    // Set environment variables for non-interactive testing
    process.env.RONIN_TOKEN = 'test-token';

    const { stdout, stderr, exitCode } = await $`bun ${CLI_PATH} --version`
      .nothrow()
      .quiet();

    console.log(stderr.toString());
    console.log(stdout.toString());

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toMatch(/\d+\.\d+\.\d+/); // Matches semver format
  });

  test('should fail init command without space handle', async () => {
    const { stderr, exitCode } = await $`RONIN_TOKEN=test-token bun ${CLI_PATH} init`
      .nothrow()
      .quiet();

    expect(exitCode).toBe(1);
    expect(stderr.toString()).toContain('Please provide a space handle like this:');
    expect(stderr.toString()).toContain('$ ronin init my-space');
  });

  test('should initialize a project', async () => {
    // Mock necessary files for a successful init
    await fs.promises.writeFile(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { types: [] } }, null, 2),
    );

    await fs.promises.writeFile(path.join(tempDir, '.gitignore'), 'node_modules\n');

    // This test might need to mock HTTP calls or use a test token
    const { stderr, exitCode } =
      await $`RONIN_TOKEN=test-token bun ${CLI_PATH} init test-space`.nothrow().quiet();

    expect(exitCode).toBe(1);
    expect(stderr.toString()).toContain('You are not a member of the "test-space" space');
  });

  test('should create a migration file with diff command', async () => {
    // Create a schema directory with model definitions
    await fs.promises.mkdir(path.join(tempDir, 'schema'), { recursive: true });
    await fs.promises.writeFile(
      path.join(tempDir, 'schema/index.ts'),
      `
      import { model } from 'ronin/schema';

      export const User = model(
        {
          slug: 'user',
          fields: {
            name: { type: 'string' },
            email: { type: 'string' }
          }
        }
    )
      `,
    );

    // Create migrations directory
    await fs.promises.mkdir(path.join(tempDir, 'migrations'), { recursive: true });

    // Create .ronin directory and config.json with test space
    await fs.promises.mkdir(path.join(tempDir, '.ronin'), { recursive: true });
    await fs.promises.writeFile(
      path.join(tempDir, '.ronin/config.json'),
      JSON.stringify({ space: 'test-space' }, null, 2),
    );

    // Create package.json with ronin dependency
    await fs.promises.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(
        {
          name: 'test-project',
          dependencies: {
            ronin: 'latest',
          },
        },
        null,
        2,
      ),
    );

    const { stderr, stdout, exitCode } =
      await $`RONIN_TOKEN=test-token bun ${CLI_PATH} diff --local`.nothrow().quiet();

    console.error(stderr.toString());
    console.error(stdout.toString());

    expect(stderr.toString()).toContain('Successfully generated migration protocol file');
    expect(exitCode).toBe(0);
  });
});
