import fs from 'node:fs';
import path from 'node:path';
import { formatCode } from '@/src/utils/format';
import type { LocalPackages } from '@/src/utils/misc';
import type { Model, Query, Statement } from '@ronin/compiler';

/**
 * Protocol represents a set of database migration queries that can be executed in sequence.
 * It provides functionality to generate, save and load migration files and SQL statements.
 */
export class Protocol {
  private _packages: LocalPackages;
  private _queries: Array<Query> = [];
  private _roninQueries: Array<string>;
  private _protocolDir = `${process.cwd()}/schema/.protocols/`;

  /**
   * Creates a new Protocol instance.
   *
   * @param packages - A list of locally available RONIN packages.
   * @param roninQueries - Optional array of RONIN query strings to initialize with.
   */
  constructor(packages: LocalPackages, roninQueries: Array<string> = []) {
    this._packages = packages;
    this._roninQueries = roninQueries;
  }

  /**
   * Converts RONIN query strings into Query objects.
   *
   * @returns The Protocol instance for chaining.
   */
  async convertToQueryObjects(): Promise<Protocol> {
    this._queries = this._roninQueries.map((queryString) => {
      return this.queryToObject(queryString);
    });

    return this;
  }

  /**
   * Converts a query string into a Query object.
   *
   * @param query - RONIN query string.
   *
   * @returns Object containing the Query and options.
   * @private
   */
  private queryToObject = (query: string): Query => {
    const { getSyntaxProxy } = this._packages.syntax;
    const queryTypes = [
      'get',
      'set',
      'add',
      'remove',
      'count',
      'create',
      'alter',
      'drop',
    ];
    const queryProxies = queryTypes.map((type) =>
      getSyntaxProxy({ rootProperty: type as 'drop' }),
    );

    const func = new Function(...queryTypes, `"use strict"; return ${query}`);

    return func(...queryProxies).structure;
  };

  /**
   * Generates the migration file content.
   *
   * @returns Migration file content as a string.
   * @private
   */
  private createMigrationProtocol = (): string => {
    return `import { add, alter, create, drop, get, set } from 'ronin';
export default () => [
  ${this._roninQueries.map((query) => ` ${query}`).join(',\n')}
];`;
  };

  /**
   * Gets the current Query objects.
   */
  get queries(): Array<Query> {
    return this._queries;
  }

  /**
   * Gets the current RONIN query strings.
   */
  get roninQueries(): Array<string> {
    return this._roninQueries;
  }

  /**
   * Loads a protocol from a migration file.
   *
   * @param fileName - Optional name of the migration file to load. If not provided, loads
   * the latest migration.
   *
   * @returns Promise resolving to the Protocol instance
   */
  load = async (fileName?: string): Promise<Protocol> => {
    const targetFile =
      fileName ||
      (() => {
        const files = fs.readdirSync(this._protocolDir);
        return files.sort().pop() || 'migration';
      })();

    const filePath = path.resolve(this._protocolDir, targetFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration protocol file ${filePath} does not exist`);
    }

    const queries = await import(filePath);

    const { getBatchProxy } = this._packages.syntax;
    const queryObjects = getBatchProxy(() => queries.default());

    this._queries = queryObjects.map((query: { structure: Query }) => query.structure);

    return this;
  };

  /**
   * Saves the protocol to a migration file.
   *
   * @param fileName - Name for the migration file.
   *
   * @returns The Protocol instance for chaining
   */
  save = async (fileName: string): Promise<Protocol> => {
    const migrationContent = this.createMigrationProtocol();
    const directoryPath = path.resolve(this._protocolDir);

    fs.mkdirSync(directoryPath, { recursive: true });
    fs.writeFileSync(
      path.join(directoryPath, `${fileName}.ts`),
      await formatCode(migrationContent),
    );
    return this;
  };

  /**
   * Saves the SQL statements to a file.
   *
   * @param fileName - Name for the SQL file.
   * @param models - Models used to compile the queries.
   */
  saveSQL = async (fileName: string, models: Array<Model>): Promise<void> => {
    const statements = this.getSQLStatements(models);
    const sqlContent = statements.map(({ statement }) => statement).join('\n');
    fs.writeFileSync(`${this._protocolDir}${fileName}.sql`, sqlContent);
  };

  /**
   * Gets the SQL statements for the protocol.
   *
   * @param models - Models used to compile the queries.
   *
   * @returns Array of SQL statements.
   */
  getSQLStatements = (models: Array<Model>): Array<Statement> => {
    const { Transaction } = this._packages.compiler;

    return new Transaction(this._queries, {
      models,
      inlineParams: true,
    }).statements;
  };
}
