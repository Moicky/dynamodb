export declare interface KeySchema {
  hash: string;
  range?: string;
}

export declare interface KeySchemaCollection {
  [tableName: string]: KeySchema;
}

let initialized = false;
let tablesSchema: KeySchemaCollection = {};

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

export const getDefaultTable = () => {
  if (!initialized) {
    throw new Error("[@moicky/dynamodb]: Schema not initialized");
  }
  return Object.keys(tablesSchema)[0];
};

export const getTableSchema = (tableName?: string): KeySchema => {
  if (!initialized) {
    throw new Error("[@moicky/dynamodb]: Schema not initialized");
  }

  const table = tableName || getDefaultTable();
  return tablesSchema[table] || getDefaultTableSchema();
};

export const getDefaultTableSchema = (): KeySchema => {
  return { hash: "PK", range: "SK" };
};

export const isInitialized = () => initialized;
