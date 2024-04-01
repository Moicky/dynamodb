import {
  TransactWriteItem,
  TransactWriteItemsCommand,
  TransactWriteItemsCommandInput,
} from "@aws-sdk/client-dynamodb";

import {
  ExpressionAttributes,
  getClient,
  getDefaultTable,
  getItemKey,
  marshallWithOptions,
  stripKey,
  type DynamoDBItem,
} from "..";
import {
  ConditionOperations,
  CreateOperations,
  UpdateOperations,
} from "./operations";
import { WithoutReferences } from "./references/types";
import {
  ConditionOperation,
  CreateOperation,
  DeleteOperation,
  DynamoDBItemKey,
  ItemOperation,
  ItemWithKey,
  OnlyKey,
  UpdateAction,
  UpdateOperation,
} from "./types";

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html
const OPERATIONS_LIMIT = 100;

export class Transaction {
  private tableName: string;
  private timestamp = Date.now();
  private operations: { [itemKey: string]: ItemOperation } = {};

  constructor({
    tableName = getDefaultTable(),
    timestamp = Date.now(),
  }: {
    tableName?: string;
    timestamp?: number;
  } = {}) {
    this.tableName = tableName;
    this.timestamp = timestamp;
  }

  private getItemKey(item: DynamoDBItem, tableName?: string) {
    return getItemKey(item, { TableName: tableName || this.tableName });
  }

  create<T extends ItemWithKey>(
    item: WithoutReferences<T>,
    args?: CreateOperation["args"]
  ) {
    const itemKey = this.getItemKey(item, args?.TableName);

    const createOperation: CreateOperation = {
      _type: "create",
      item: item as T,
      args: { TableName: this.tableName, ...args },
    };

    this.operations[itemKey] = createOperation;

    return new CreateOperations<T>(createOperation, this);
  }
  update<T extends DynamoDBItemKey>(
    item: OnlyKey<T>,
    args?: UpdateOperation["args"]
  ) {
    const itemKey = this.getItemKey(item, args?.TableName);

    const updateOperation: UpdateOperation = {
      _type: "update",
      item,
      actions: [{ _type: "set", values: { updatedAt: this.timestamp } }],
      args: { TableName: this.tableName, ...args },
    };

    this.operations[itemKey] = updateOperation;

    return new UpdateOperations<T>(updateOperation, this);
  }
  delete(item: DynamoDBItemKey, args?: DeleteOperation["args"]) {
    const itemKey = this.getItemKey(item, args?.TableName);

    this.operations[itemKey] = {
      _type: "delete",
      item,
      args: { TableName: this.tableName, ...args },
    };
  }
  addConditionFor<T extends DynamoDBItemKey>(
    item: T,
    args?: Partial<ConditionOperation["args"]>
  ) {
    return new ConditionOperations<T>(this.operations, item, {
      TableName: this.tableName,
      ...args,
    });
  }

  private handleOperation(operation: ItemOperation): TransactWriteItem {
    switch (operation._type) {
      case "create": {
        const { item, args } = operation;

        return {
          Put: {
            Item: marshallWithOptions({ createdAt: this.timestamp, ...item }),
            ...args,
          },
        };
      }
      case "update": {
        const { item, actions, args } = operation;

        const expressions: { [type in UpdateAction["_type"]]: string[] } = {
          add: [],
          delete: [],
          remove: [],
          set: [],
        };

        const {
          ExpressionAttributeValues,
          ExpressionAttributeNames,
          ...otherArgs
        } = args;
        const attr = new ExpressionAttributes(
          ExpressionAttributeValues,
          ExpressionAttributeNames
        );

        actions.forEach((action) => {
          switch (action._type) {
            case "set":
              attr.appendBoth(action.values);

              expressions.set.push(
                Object.keys(action.values)
                  .map((key) => `${attr.getName(key)} = ${attr.getValue(key)}`)
                  .join(", ")
              );
              break;
            case "remove":
              attr.appendNames(action.attributes);

              expressions.remove.push(
                action.attributes.map((key) => attr.getName(key)).join(", ")
              );
              break;
            case "add":
              attr.appendBoth(action.values);

              expressions.add.push(
                Object.keys(action.values)
                  .map((key) => `${attr.getName(key)} ${attr.getValue(key)}`)
                  .join(", ")
              );
              break;
            case "delete":
              attr.appendBoth(action.values);

              expressions.delete.push(
                Object.keys(action.values)
                  .map((key) => `${attr.getName(key)} ${attr.getValue(key)}`)
                  .join(", ")
              );
              break;
          }
        });

        const joinedExpressions = Object.entries(expressions)
          .filter(([, value]) => value?.length)
          .reduce(
            (acc, [t, v]) => [...acc, `${t.toUpperCase()} ${v.join(", ")}`],
            []
          )
          .join(" ");

        return {
          Update: {
            Key: stripKey(item),
            UpdateExpression: joinedExpressions,
            ...attr.getAttributes(),
            ...otherArgs,
          },
        };
      }
      case "delete": {
        const { item, args } = operation;

        return { Delete: { Key: stripKey(item), ...args } };
      }
      case "condition": {
        const { item, args } = operation;
        return { ConditionCheck: { Key: stripKey(item), ...args } };
      }
    }
  }

  async execute(
    args?: Partial<Omit<TransactWriteItemsCommandInput, "TransactItems">>
  ) {
    const operations = Object.values(this.operations).map((op) =>
      this.handleOperation(op)
    );

    if (operations.length === 0 || operations.length > OPERATIONS_LIMIT) {
      throw new Error("Invalid number of operations");
    }

    const input = {
      TransactItems: operations,
      ...args,
    } satisfies TransactWriteItemsCommandInput;

    return getClient()
      .send(new TransactWriteItemsCommand(input))
      .catch((err) => ({ ...err, args: input }));
  }
}
