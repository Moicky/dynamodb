import {
  BatchGetItemCommand,
  BatchGetItemCommandInput,
  GetItemCommand,
  GetItemCommandInput,
  ScanCommand,
  ScanCommandInput,
} from "@aws-sdk/client-dynamodb";

import {
  getClient,
  getDefaultTable,
  splitEvery,
  stripKey,
  unmarshallWithOptions,
  withDefaults,
  withFixes,
} from "../lib";

/**
 * Retrieves an item from the DynamoDB table using its key schema.
 * @param key - The item with at least the partition key and the sort key (if applicable) of the item to get.
 * @param args - The additional arguments to override or specify for {@link GetItemCommandInput}
 * @returns A promise that resolves to the unmarshalled item
 *
 * @example
 * Get a single item
 * ```javascript
 * await getItem({
 *   PK: "User/1",
 *   SK: "Book/1",
 *   title: "The Great Gatsby",
 *   author: "F. Scott Fitzgerald",
 *   released: 1925,
 * });
 * ```
 * @example
 * Get a single item in a different table
 * ```javascript
 * await getItem(
 *   { PK: "User/1", SK: "Book/1" },
 *   { TableName: "AnotherTable" }
 * );
 * ```
 */
export async function getItem(
  key: any,
  args: Partial<GetItemCommandInput> = {}
): Promise<Record<string, any> | undefined> {
  args = withDefaults(args, "getItem");

  return getClient()
    .send(
      new GetItemCommand({
        Key: stripKey(key, args),
        ...args,
        TableName: args?.TableName || getDefaultTable(),
      })
    )
    .then((res) => res?.Item && unmarshallWithOptions(res.Item));
}

type GetItemsArgs = Partial<
  BatchGetItemCommandInput & {
    TableName?: string;
  }
>;

/**
 * Retrieves multiple items from the DynamoDB table using their key schema.
 * @param keys - The items with at least the partition key and the sort key (if applicable) of the items to get.
 * @param args - The additional arguments to override or specify for {@link GetItemsArgs}
 * @returns A promise that resolves to an array of unmarshalled items
 *
 * @example
 * Get items in default table
 * ```javascript
 * await getItems([
 *   { PK: "User/1", SK: "Book/1", title: "The Great Gatsby", released: 1925 },
 *   { PK: "User/1", SK: "Book/2" },
 *   { PK: "User/1", SK: "Book/3" },
 *   // ... infinite more items (will be grouped into batches of 100 due to aws limit) and retried up to 3 times
 * ]);
 * ```
 * @example
 * Get items in a different table
 * ```javascript
 * await getItems(
 *   [
 *     { PK: "User/1", SK: "Book/1", title: "The Great Gatsby", released: 1925 },
 *     { PK: "User/1", SK: "Book/2" },
 *     { PK: "User/1", SK: "Book/3" },
 *   ],
 *   { TableName: "AnotherTable" }
 * );
 * ```
 */
export async function getItems(
  keys: any[],
  args: GetItemsArgs = {},
  retry = 0
) {
  args = withDefaults(args, "getItems");

  // creates batches of 100 items each and performs batchGet on every batch.
  // also retries up to 3 times if there are unprocessed items (due to size limit of 16MB)
  // returns items in same order as keys (not sorted by default when using batchGet)
  if (retry > 3) return [];
  const batchReadLimit = 100;
  // duplicate key entries would cause an error, so we remove them
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

  const batches = splitEvery(uniqueKeys, batchReadLimit);
  const results: Record<string, any>[] = [];

  if (retry > 2) {
    return results;
  }
  const TableName = args?.TableName || getDefaultTable();
  delete args.TableName;

  await Promise.all(
    batches.map(async (batch) => {
      await getClient()
        .send(
          new BatchGetItemCommand({
            RequestItems: {
              [TableName]: {
                Keys: batch,
                ...args,
              },
            },
          })
        )
        .then((res) => {
          const unprocessed = res?.UnprocessedKeys?.[TableName];
          const allItemsFromBatch = res?.Responses?.[TableName] || [];
          if (unprocessed) {
            return getItems(
              unprocessed.Keys,
              { ...args, TableName },
              retry + 1
            ).then((items) => allItemsFromBatch.concat(items));
          }
          return allItemsFromBatch.map(
            (item) => item && unmarshallWithOptions(item)
          );
        })
        .then((items) => results.push(...items));
    })
  );
  const resultItems = results
    .filter((i: any) => i)
    .reduce((acc: Record<string, any>, item: any) => {
      const keyString = JSON.stringify(stripKey(item, { TableName }));
      acc[keyString] = item;
      return acc;
    }, {});

  return keys.map(
    (key) =>
      resultItems[JSON.stringify(stripKey(key, { TableName }))] || undefined
  ) as (Record<string, any> | undefined)[];
}

/**
 * Retrieves all items from the DynamoDB table.
 * @param args - The additional arguments to override or specify for {@link ScanCommandInput}
 * @returns A promise that resolves to an array of unmarshalled items
 *
 * @example
 * Retrieve all items in default table
 * ```javascript
 * await getAllItems();
 * ```
 * @example
 * Retrieve all items in a different table
 * ```javascript
 * await getAllItems(
 *   { TableName: "AnotherTable" }
 * );
 * ```
 */
export async function getAllItems(args: Partial<ScanCommandInput> = {}) {
  args = withFixes(withDefaults(args, "getAllItems"));

  return getClient()
    .send(
      new ScanCommand({
        ...args,
        TableName: args?.TableName || getDefaultTable(),
      })
    )
    .then((res) =>
      res.Items.map((item) => item && unmarshallWithOptions(item))
    );
}
