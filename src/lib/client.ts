import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

declare interface KeySchema {
  hash: string;
  range?: string;
}

declare interface KeySchemaCollection {
  [tableName: string]: KeySchema;
}

class DynamoDBConfig {
  client: DynamoDBClient;
  tablesSchema: KeySchemaCollection = {};
  #initialized = false;

  constructor({ region }: { region?: string } = {}) {
    this.client = new DynamoDBClient({
      region: region || process.env.AWS_REGION || "eu-central-1",
    });

    const defaultTable = process.env.DYNAMODB_TABLE as string;

    if (defaultTable) {
      this.tablesSchema[defaultTable] = {
        hash: "PK",
        range: "SK",
      };

      this.#initialized = true;
    }
  }

  initSchema(schema: KeySchemaCollection): KeySchemaCollection {
    if (!this.validateSchema(schema)) {
      throw new Error("Invalid schema");
    }

    this.tablesSchema = Object.keys(schema).reduce((acc, table) => {
      const { hash, range } = schema[table];

      acc[table] = {
        hash: hash + "",
        ...(range && { range: range + "" }),
      };

      return acc;
    }, {});

    this.#initialized = true;
    return this.tablesSchema;
  }

  getDefaultTable() {
    if (!this.#initialized) {
      throw new Error("Schema not initialized");
    }
    const table = Object.keys(this.tablesSchema)[0];
    return table;
  }

  getTableSchema(tableName?: string): KeySchema {
    if (!this.#initialized) {
      throw new Error("Schema not initialized");
    }

    const table = tableName || this.getDefaultTable();
    return this.tablesSchema[table] || this.getDefaultTableSchema();
  }

  getDefaultTableSchema(): KeySchema {
    return { hash: "PK", range: "SK" };
  }

  validateSchema(schema: KeySchemaCollection) {
    const tables = Object.keys(schema);

    if (tables.length === 0) {
      throw new Error("No tables provided");
    }

    tables.forEach((table) => {
      const { hash } = schema[table];

      if (!hash) {
        throw new Error(`No hash key provided for table ${table}`);
      }
    });

    return true;
  }

  destroy() {
    this.client.destroy();
  }
}

const config = new DynamoDBConfig();

export const client = config.client;
export const getDefaultTable = config.getDefaultTable.bind(
  config
) as typeof config.getDefaultTable;

export const getTableSchema = config.getTableSchema.bind(
  config
) as typeof config.getTableSchema;

export const getDefaultTableSchema = config.getDefaultTableSchema.bind(
  config
) as typeof config.getDefaultTableSchema;

export const initSchema = config.initSchema.bind(
  config
) as typeof config.initSchema;

export const destroy = config.destroy.bind(config) as typeof config.destroy;

export default config;
