import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  deleteItem,
  deleteItems,
  getItem,
  getItems,
  getAllItems,
  putItem,
  putItems,
  query,
  queryItems,
  queryAllItems,
  updateItem,
  removeAttributes,
} from "../operations";

interface OperationArguments {
  deleteItem?: Parameters<typeof deleteItem>[1];
  deleteItems?: Parameters<typeof deleteItems>[1];

  getItem?: Parameters<typeof getItem>[1];
  getItems?: Parameters<typeof getItems>[1];
  getAllItems?: Parameters<typeof getAllItems>[0];

  putItem?: Parameters<typeof putItem>[1];
  putItems?: Parameters<typeof putItems>[1];

  query?: Parameters<typeof query>[2];
  queryItems?: Parameters<typeof queryItems>[2];
  queryAllItems?: Parameters<typeof queryAllItems>[2];

  updateItem?: Parameters<typeof updateItem>[2];
  removeAttributes?: Parameters<typeof removeAttributes>[2];
}

type Operation = keyof OperationArguments;

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
  #defaults: OperationArguments = {};

  constructor({ region }: { region?: string } = {}) {
    this.client = new DynamoDBClient({
      region: region || process.env.AWS_REGION || "eu-central-1",
    });

    const defaultTable = process.env.DYNAMODB_TABLE as string;

    if (defaultTable) {
      this.initSchema({
        [defaultTable]: {
          hash: "PK",
          range: "SK",
        },
      });
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
    return Object.keys(this.tablesSchema)[0];
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

  initDefaults(newDefaults: OperationArguments) {
    this.#defaults = { ...newDefaults };
  }

  withDefaults<T extends Operation>(
    args: OperationArguments[T],
    operation: T
  ): OperationArguments[T] {
    return {
      ...this.#defaults[operation],
      ...args,
    };
  }

  destroy() {
    this.client.destroy();
  }
}

const config = new DynamoDBConfig();

const bind = <T extends (...args: any[]) => any>(fn: T): T => {
  return fn.bind(config);
};

export const client = config.client;
export const initSchema = bind(config.initSchema);
export const getDefaultTable = bind(config.getDefaultTable);
export const getDefaultTableSchema = bind(config.getDefaultTableSchema);
export const validateSchema = bind(config.validateSchema);
export const getTableSchema = bind(config.getTableSchema);
export const initDefaults = bind(config.initDefaults);
export const withDefaults = bind(config.withDefaults);
export const destroy = bind(config.destroy);

export default config;
