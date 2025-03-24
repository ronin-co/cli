import { spinner } from '@/src/utils/spinner';

export default async (): Promise<void> => {
  spinner.stop();

  await Bun.sleep(1000);
};
