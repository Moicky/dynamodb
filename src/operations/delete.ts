import {
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  DeleteItemCommand,
  DeleteItemCommandInput,
  DeleteItemCommandOutput,
} from "@aws-sdk/client-dynamodb";

import {
  getClient,
  getDefaultTable,
  splitEvery,
  stripKey,
  withDefaults,
} from "../lib";
import { DynamoDBItem } from "../types";

/**
 * Deletes an item from the DynamoDB table using its key schema.
 * @param key - The item with at least the partition key and the sort key (if applicable) of the item to delete.
 * @param args - The additional arguments to override or specify for {@link DeleteItemCommandInput}
 * @returns A promise that resolves to the output of {@link DeleteItemCommandOutput}
 *
 * @example
 * Delete a single item in default table
 * ```javascript
 * await deleteItem({
 *   PK: "User/1",
 *   SK: "Book/1",
 *   // fields which are not part of the key schema will be removed
 *   title: "The Great Gatsby",
 *   author: "F. Scott Fitzgerald",
 *   released: 1925,
 * });
 * ```
 * @example
 * Delete a single item in a different table
 * ```javascript
 * await deleteItem(
 *   { PK: "User/1", SK: "Book/1" },
 *   { TableName: "AnotherTable" }
 * );
 * ```
 */
export async function deleteItem(
  key: DynamoDBItem,
  args: Partial<DeleteItemCommandInput> = {}
): Promise<DeleteItemCommandOutput> {
  return getClient().send(
    new DeleteItemCommand({
      Key: stripKey(key, args),
      ...withDefaults(args, "deleteItem"),
      TableName: args?.TableName || getDefaultTable(),
    })
  );
}

type DeleteItemsArgs = Partial<
  BatchWriteItemCommandInput & {
    TableName?: string;
  }
>;

/**
 * Deletes unlimited items from the DynamoDB table using their key schema.
 * @param keys - The items with at least the partition key and the sort key (if applicable) of the items to delete.
 * @param args - The additional arguments to override or specify for {@link DeleteItemsArgs}
 * @returns A promise that resolves to void
 *
 * @example
 * Delete items in default table
 * ```javascript
 * await deleteItems([
 *   // fields which are not part of the key schema will be removed
 *   { PK: "User/1", SK: "Book/1", title: "The Great Gatsby", released: 1925 },
 *   { PK: "User/1", SK: "Book/2" },
 *   { PK: "User/1", SK: "Book/3" },
 *   // ... infinite more items (will be grouped into batches of 25 due to aws limit)
 *   // and retried up to 3 times
 * ]);
 * ```
 * @example
 * Delete items in a different table
 * ```javascript
 * await deleteItems(
 *   [
 *     // fields which are not part of the key schema will be removed
 *     { PK: "User/1", SK: "Book/1", title: "The Great Gatsby", released: 1925 },
 *     { PK: "User/1", SK: "Book/2" },
 *     { PK: "User/1", SK: "Book/3" },
 *   ],
 *   { TableName: "AnotherTable" }
 * );
 * ```
 */
export async function deleteItems(
  keys: DynamoDBItem[],
  args: DeleteItemsArgs = {},
  retry = 0
): Promise<void> {
  args = withDefaults(args, "deleteItems");
  const uniqueKeys = Object.values(
    keys.reduce((acc, key) => {
      const strippedKey = stripKey(key, args);
      const keyString = JSON.stringify(strippedKey);
      if (!acc[keyString]) {
        acc[keyString] = strippedKey;
      }
      return acc;
    }, {})
  ) as Record<string, any>[];

  return new Promise(async (resolve, reject) => {
    const batches = splitEvery(uniqueKeys);

    if (retry > 3) return;

    const table = args?.TableName || getDefaultTable();
    for (const batch of batches) {
      await getClient()
        .send(
          new BatchWriteItemCommand({
            RequestItems: {
              [table]: batch.map((Key) => ({
                DeleteRequest: {
                  Key,
                },
              })),
            },
            ...args,
          })
        )
        .then((res) => {
          if (res?.UnprocessedItems?.[table]?.length) {
            if (retry + 1 > 3) return reject(res);
            return deleteItems(
              res.UnprocessedItems[table].map((d) => d?.DeleteRequest?.Key),
              { ...args, TableName: table },
              retry + 1
            );
          }
        })
        .catch(reject);
    }
    resolve();
  });
}
