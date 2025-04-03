import { spinner } from '@/src/utils/spinner';
import chalkTemplate from 'chalk-template';

export const printVersion = (version: string): Promise<void> => {
  spinner.stop();
  console.log(version);
  process.exit(0);
};

export const printHelp = (): Promise<void> => {
  const text = chalkTemplate`
  {bold.magenta ronin} — Data at the edge

  {bold USAGE}

      {bold $} {bold.magenta ronin}
      {bold $} {bold.magenta ronin} login
      {bold $} {bold.magenta ronin} --help
      {bold $} {bold.magenta ronin} --version

  {bold COMMANDS}

      login                               Authenticate with RONIN (run by default for every command)
      init [space]                        Initialize the TypeScript types for a given space
      diff                                Compare the database schema with the local schema and create a patch
      apply                               Apply the most recent patch to the database
      types                               Generates TypeScript types for the database schema

  {bold OPTIONS}

      -h, --help                          Shows this help message
      -v, --version                       Shows the version of the CLI that is currently installed
      -d, --debug                         Shows additional debugging information
      -c, --clean                         Creates the migration against a clean database
  `;
  console.log(text);
  process.exit(0);
};
