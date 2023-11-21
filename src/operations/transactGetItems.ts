import {
  Get,
  TransactGetItemsCommand,
  TransactGetItemsCommandInput,
  TransactGetItemsCommandOutput,
} from "@aws-sdk/client-dynamodb";

import {
  getClient,
  getDefaultTable,
  splitEvery,
  stripKey,
  unmarshallWithOptions,
  withDefaults,
} from "../lib";

/**
 * Performs a TransactGetItems operation against DynamoDB. This allows you to retrieve many items at once.
 * @param keys - Array of items to retrieve. Each item requires a `key` property, with at least the partition and the sort key (according to the table definition).
 * @param args - The additional arguments to override or specify for {@link TransactGetItemsCommandInput}
 * @returns A promise that resolves to an unmarshalled items array
 *
 * @example
 * Get items from the default-table
 * ```javascript
 * const items = await transactGetItems([
 *    { key: { PK: "User/1", SK: "Book/1", title: "The Great Gatsby", released: 1925 }},
 *    { key: { PK: "User/1", SK: "Book/2" }},
 *    { key: { PK: "User/1", SK: "Book/3" }},
 * ]);
 * ```
 * @example
 * Get items from a different tables
 * ```javascript
 * const items = await transactGetItems([
 *    { TableName: "yourTable", key: { PK: "User/1", SK: "Book/2" }},
 *    { TableName: "yourOtherTable", key: { PK: "User/1", SK: "Book/3" }},
 * ]);
 * ```
 * @example
 * Get all items from a non-default table
 * ```javascript
 * const items = await transactGetItems(
 *   [
 *     { key: { PK: "User/1", SK: "Book/2" } },
 *     { key: { PK: "User/1", SK: "Book/3" } },
 *   ],
 *   { TableName: "yourTable" }
 * );
 * ```
 */
export function transactGetItems<
  T extends Record<string, any> = Array<Record<string, any> | undefined>
>(
  keys: Array<
    Omit<Get, "TableName" | "Key"> & {
      key: Record<string, any>;
      TableName?: string;
    }
  >,
  args?: Partial<
    TransactGetItemsCommandInput & {
      TableName?: string;
    }
  >
): Promise<T[]> {
  return new Promise(async (resolve, reject) => {
    args = withDefaults(args, "transactGetItems");
    const { TableName, ...otherArgs } = args;

    const defaultTable = TableName || getDefaultTable();

    const batches = splitEvery(keys, 100);
    const results: TransactGetItemsCommandOutput[] = [];

    for (const batch of batches) {
      await getClient()
        .send(
          new TransactGetItemsCommand({
            TransactItems: batch.map((item) => {
              const table = item.TableName || defaultTable;
              return {
                Get: {
                  Key: stripKey(item.key, { TableName: table }),
                  TableName: table,
                  ExpressionAttributeNames: item.ExpressionAttributeNames,
                  ProjectionExpression: item.ProjectionExpression,
                },
              };
            }),
            ...otherArgs,
          })
        )
        .then((res) => results.push(res))
        .catch(reject);
    }

    resolve(
      results.flatMap(
        (result) =>
          result.Responses?.map((item) =>
            item?.Item ? unmarshallWithOptions(item.Item) : undefined
          ) || []
      ) as T[]
    );
  });
}
