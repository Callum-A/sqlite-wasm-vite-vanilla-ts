// @ts-ignore
import { sqlite3Worker1Promiser } from '@sqlite.org/sqlite-wasm';

const BASE_DATABASES_DIRECTORY = 'databases';

export type SqlitePromiser = (command: string, params: any) => Promise<any>;

export class SqliteConnector {
  private promiser: SqlitePromiser;

  private dbId: string;

  constructor(promiser: SqlitePromiser, dbId: string) {
    this.promiser = promiser;
    this.dbId = dbId;
  }

  public async execute(sql: string, params: any[] = []) {
    await this.promiser('exec', {
      sql,
      dbId: this.dbId,
      bind: params,
      rowMode: 'object',
    });
  }

  public async close() {
    const result = await this.promiser('close', {
      dbId: this.dbId,
    });
    console.log(result);
  }

  public async queryMany<T>(
    sql: string,
    params: any[] = [],
    handleRow: (row: any) => T = (r) => r
  ): Promise<T[]> {
    const result = await this.promiser('exec', {
      sql,
      dbId: this.dbId,
      bind: params,
      rowMode: 'object',
    });
    const { resultRows: rows } = result.result;
    const processedRows = [];
    for (const row of rows) {
      processedRows.push(handleRow(row));
    }
    return processedRows;
  }

  public async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    const result = await this.promiser('exec', {
      sql,
      dbId: this.dbId,
      bind: params,
      rowMode: 'object',
    });
    const { resultRows: rows } = result.result;

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  }
}

const buildDBPath = (dbName: string) => {
  return `file:/${BASE_DATABASES_DIRECTORY}/${dbName}`;
};

/**
 * Delete the database, database must be closed before doing this.
 * @param dbName Name of the database to delete
 */
export const deleteDB = async (dbName: string) => {
  const root = await navigator.storage.getDirectory();
  try {
    const dir = await root.getDirectoryHandle(BASE_DATABASES_DIRECTORY);
    // @ts-ignore
    for await (const entry of await dir.values()) {
      if (entry.name === dbName) {
        console.log('Trying to delete', entry.name);
        await dir.removeEntry(entry.name, { recursive: true });
      }
    }
  } catch (err: any) {
    return;
  }
};

/**
 * Check if the database with the given name already exists, if so return true.
 * @param dbName Name of the database to check if exists
 */
export const doesDBNameAlreadyExist = async (
  dbName: string
): Promise<boolean> => {
  const root = await navigator.storage.getDirectory();
  try {
    const dir = await root.getDirectoryHandle(BASE_DATABASES_DIRECTORY);
    console.log(dir);
    // @ts-ignore
    for await (const entry of await dir.values()) {
      console.log(entry);
      if (entry.name === dbName) {
        return true;
      }
    }
  } catch (err: any) {
    return false;
  }

  return false;
};

/**
 * List all DBs in the base DB directory.
 * @returns A list of all available DBs in the base DB directory
 */
export const listAllDBs = async (): Promise<string[]> => {
  const root = await navigator.storage.getDirectory();
  try {
    const dbs = [];
    const dir = await root.getDirectoryHandle(BASE_DATABASES_DIRECTORY);
    // @ts-ignore
    for await (const entry of await dir.values()) {
      console.log(entry);
      if (entry.kind === 'file') {
        dbs.push(entry.name);
      }
    }
    return dbs;
  } catch (err: any) {
    return [];
  }
};

/**
 * Open a database connection
 * @param dbName Name of the database to open, will be created if not exist
 * @returns Database handle
 */
const connectToDB = async (dbName: string) => {
  try {
    console.log('Loading and initializing SQLite3 module...');

    const promiser: SqlitePromiser = await new Promise((resolve) => {
      const _promiser = sqlite3Worker1Promiser({
        onready: () => resolve(_promiser),
      });
    });

    console.log('Done initializing. Running demo...');

    const configResponse = await promiser('config-get', {});
    console.log(
      'Running SQLite3 version',
      configResponse.result.version.libVersion
    );

    const baseFilename = buildDBPath(dbName);
    const filename = `${baseFilename}?vfs=opfs`;

    const openResponse = await promiser('open', {
      filename,
    });
    const { dbId } = openResponse;
    console.log(
      'OPFS is available, created persisted database at',
      openResponse.result.filename.replace(/^file:(.*?)\?vfs=opfs$/, '$1')
    );

    const sqliteConnector = new SqliteConnector(promiser, dbId);

    return sqliteConnector;
  } catch (err: any) {
    if (!(err instanceof Error)) {
      err = new Error(err.result.message);
    }
    console.error(err.name, err.message);
    return null;
  }
};

export default connectToDB;
