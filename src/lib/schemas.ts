/**
 * @property {string} hash - The name of the hash key.
 * @property {string} [range] - The name of the range key. Only required if the table has a range key.
 */
export declare interface KeySchema {
  hash: string;
  range?: string;
}

/**
 * @property {string} tableName - The name of the table.
 */
export declare interface KeySchemaCollection {
  [tableName: string]: KeySchema;
}

let initialized = false;
let tablesSchema: KeySchemaCollection = {};

/**
 * Initializes the {@link KeySchemaCollection} to use for all operations.
 * @param schema - The new {@link KeySchemaCollection} to use
 * @returns The new {@link KeySchemaCollection}
 */
export const initSchema = (
  schema: KeySchemaCollection
): KeySchemaCollection => {
  if (!validateSchema(schema)) {
    throw new Error("[@moicky/dynamodb]: Invalid schema");
  }

  tablesSchema = Object.keys(schema).reduce((acc, table) => {
    const { hash, range } = schema[table];

    acc[table] = {
      hash: hash + "",
      ...(range && { range: range + "" }),
    };

    return acc;
  }, {});

  initialized = true;
  return tablesSchema;
};

/**
 * Validates the {@link KeySchemaCollection} to use for all operations.
 * @param schema - The {@link KeySchemaCollection} to validate
 * @returns true if the schema is valid
 */
export const validateSchema = (schema: KeySchemaCollection) => {
  const tables = Object.keys(schema);

  if (tables.length === 0) {
    throw new Error("[@moicky/dynamodb]: No tables provided");
  }

  tables.forEach((table) => {
    const { hash } = schema[table];

    if (!hash) {
      throw new Error(`No hash key provided for table ${table}`);
    }

    if (typeof hash !== "string") {
      throw new Error(`Invalid hash key provided for table ${table}`);
    }

    const { range } = schema[table];

    if (range && typeof range !== "string") {
      throw new Error(`Invalid range key provided for table ${table}`);
    }
  });

  return true;
};

/**
 * Returns the first table name from the {@link KeySchemaCollection}.
 */
export const getDefaultTable = () => {
  if (!initialized) {
    throw new Error("[@moicky/dynamodb]: Schema not initialized");
  }
  return Object.keys(tablesSchema)[0];
};

/**
 * Returns the {@link KeySchema} for the given or default table.
 */
export const getTableSchema = (tableName?: string): KeySchema => {
  if (!initialized) {
    throw new Error("[@moicky/dynamodb]: Schema not initialized");
  }

  const table = tableName || getDefaultTable();
  return tablesSchema[table] || getDefaultTableSchema();
};

/**
 * Returns the default {@link KeySchema}.
 * @returns The default {@link KeySchema}
 */
export const getDefaultTableSchema = (): KeySchema => {
  return { hash: "PK", range: "SK" };
};

/**
 * Returns whether the {@link KeySchemaCollection} has been initialized.
 * @returns true if the {@link KeySchemaCollection} has been initialized
 */
export const isInitialized = () => initialized;
