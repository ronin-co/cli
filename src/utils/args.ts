import type { ArgsDef, Resolvable } from 'citty';

export const SHARED_ARGS = {
  debug: {
    alias: 'd',
    description: 'Shows additional debugging information',
    type: 'boolean',
  },
} satisfies Resolvable<ArgsDef>;
