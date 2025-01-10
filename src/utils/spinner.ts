import ora, { type Ora } from 'ora';
import { version } from '../../package.json';

/** Current status of the migration creation process */
export type Status = 'readingConfig' | 'readingModels' | 'comparing' | 'syncing';

export const spinner: Ora = ora(`RONIN ${version}`).start();

