import { defineCommand, runMain, showUsage } from 'citty';

import { BASE_FLAGS } from '@/src/utils/misc';
import { spinner } from '@/src/utils/spinner';

interface RunOptions {
  /**
   * The version of the CLI.
   *
   * This is used to display the version of the CLI when the `--version` flag is provided.
   *
   * @example
   * ```ts
   * run({ version: '1.0.0' });
   * ```
   */
  version: string;
}

/**
 * Runs the RONIN command-line interface (CLI) with the provided configuration options.
 *
 * The `@ronin/cli` package intentionally doesn't do this itself, since the CLI is instead
 * automatically installed and exposed via the shorter `ronin` package name.
 *
 * @param config - Options for customizing the behavior of the CLI.
 *
 * @returns Nothing.
 */
const run = async (config: RunOptions): Promise<void> => {
  const mainCommand = defineCommand({
    meta: {
      name: 'ronin',
      description: 'Data at the edge',
      version: config.version,
    },
    args: {
      ...BASE_FLAGS,
    },
    setup: async ({ cmd, rawArgs }): Promise<void> => {
      // By default `citty` does not print the help message if no command(s) are provided.
      const hasNoArgs = rawArgs.length === 0;
      const hasNoSubCommand = rawArgs.some((arg) => arg.startsWith('-'));
      if (hasNoArgs || hasNoSubCommand) {
        await showUsage(cmd);
        process.exit(0);
      }
    },
    cleanup: (): void => {
      spinner.stop();
      process.exit(0);
    },
    subCommands: {},
  });

  function shutdown(): void {
    spinner.stop();
    process.exit(0);
  }

  // Gracefully handle shutdown signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return runMain(mainCommand);
};

export default run;
