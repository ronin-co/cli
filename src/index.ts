import { parseArgs } from 'node:util';

import initializeProject from '@/src/commands/init';
import logIn from '@/src/commands/login';
import migrate from '@/src/commands/migration';
import { printHelp, printVersion } from '@/src/utils/info';
import { BASE_FLAGS, type BaseFlags } from '@/src/utils/misc';
import { getSession } from '@/src/utils/session';

let flags: BaseFlags;
let positionals: Array<string>;

try {
  ({ values: flags, positionals } = parseArgs({
    args: process.argv,
    options: BASE_FLAGS,
    strict: true,
    allowPositionals: true,
  }));
} catch (err) {
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    throw err;
  }

  process.exit(1);
}

const run = async (): Promise<void> => {
  // Flags for printing useful information about the CLI.
  if (flags.help) return printHelp();
  if (flags.version) return printVersion();

  // This ensures that people can accidentally type uppercase letters and still get the
  // command they are looking for.
  const normalizedPositionals = positionals.map((positional) => positional.toLowerCase());

  // If this environment variable is provided, the CLI will authenticate as an app for a
  // particular space instead of authenticating as an account. This is especially useful
  // in CI, which must be independent of individual people.
  const appToken = process.env.RONIN_TOKEN;

  // If there is no active session, automatically start one and then continue with the
  // execution of the requested sub command, if there is one. If the `login` sub command
  // is invoked, we don't need to auto-login, since the command itself will handle it.
  const session = await getSession();

  if (!(process.stdout.isTTY || session || appToken)) {
    let message = 'If RONIN CLI is invoked from a non-interactive shell, ';
    message +=
      'a `RONIN_TOKEN` environment variable containing an app token must be provided.';

    console.error(message);
    process.exit(1);
  }

  if (!(session || normalizedPositionals.includes('login'))) await logIn(appToken, false);

  // `login` sub command
  if (normalizedPositionals.includes('login')) return logIn(appToken);

  // `init` sub command
  if (normalizedPositionals.includes('init')) return initializeProject(positionals);

  // Handle 'migration' command
  if (normalizedPositionals.includes('migration')) {
    return migrate(appToken, session?.token, flags, positionals);
  }

  // If no matching flags or commands were found, render the help, since we don't want to
  // use the main `ronin` command for anything yet.
  return printHelp();
};

run();

// Exit gracefully on SIGINT
process.on('SIGINT', () => {
  process.exit(0);
});

// Exit gracefully on SIGTERM
process.on('SIGTERM', () => {
  process.exit(0);
});
