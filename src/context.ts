export class Context {
  static #instance: Context;

  appToken: string | null = null;
  userToken: string | null = null;

  private constructor() {}

  static get instance(): Context {
    if (!Context.#instance) Context.#instance = new Context();
    return Context.#instance;
  }

  /**
   * Initialize the shared context for the CLI by validating
   * the provided app token or session token.
   */
  async setup(): Promise<void> {
    // TODO: Re-implement the current session setup logic.
    // https://github.com/ronin-co/cli/blob/main/src/index.ts#L62-L81
  }
}
