import {
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  BatchWriteItemCommandOutput,
  PutItemCommand,
  PutItemCommandOutput,
  PutItemCommandInput as _PutItemCommandInput,
} from "@aws-sdk/client-dynamodb";

import {
  getClient,
  getDefaultTable,
  marshallWithOptions,
  splitEvery,
  unmarshallWithOptions,
  withDefaults,
} from "../lib";
import { DynamoDBItem } from "../types";

// Fixes types since aws-sdk-js-v3 is wrong here
type PutItemCommandInput = Omit<_PutItemCommandInput, "ReturnValues"> & {
  ReturnValues?: "NONE" | "ALL_OLD" | "ALL_NEW";
};

/**
 * Inserts an item into the DynamoDB table.
 * @param item - The item to insert into the table.
 * @param args - The additional arguments to override or specify for {@link PutItemCommandInput}
 * @returns A promise that resolves to the output of {@link PutItemCommandOutput} or the unmarshalled attributes if 'ReturnValues' is specified in 'args'.
 *
 * @example
 * Put a single item into DynamoDB
 * ```javascript
 * await putItem({
 *   PK: "User/1",
 *   SK: "Book/1",
 *   title: "The Great Gatsby",
 *   author: "F. Scott Fitzgerald",
 *   released: 1925,
 * });
 * ```
 */
export async function putItem<T extends DynamoDBItem>(
  item: T,
  args: Partial<PutItemCommandInput> & { ReturnValues: string }
): Promise<T>;
export async function putItem<
  T extends DynamoDBItem,
  K extends Partial<PutItemCommandInput> = Partial<PutItemCommandInput>
>(item: T, args?: K): Promise<PutItemCommandOutput>;
export async function putItem<
  T extends DynamoDBItem,
  K extends Partial<PutItemCommandInput> = Partial<PutItemCommandInput>
>(item: T, args?: K): Promise<T | PutItemCommandOutput> {
  const argsWithDefaults = withDefaults(args || {}, "putItem");

  if (!Object.keys(item).includes("createdAt")) {
    item = { ...item, createdAt: new Date().toISOString(), createdAtISO: new Date().toISOString() };
  }
  const { ReturnValues, ...otherArgs } = argsWithDefaults;

  return getClient()
    .send(
      new PutItemCommand({
        Item: marshallWithOptions(item),
        ...otherArgs,
        ...(ReturnValues && ReturnValues !== "ALL_NEW" && { ReturnValues }),
        TableName: otherArgs?.TableName || getDefaultTable(),
      })
    )
    .then((res) =>
      ReturnValues
        ? ReturnValues === "ALL_NEW"
          ? item
          : unmarshallWithOptions<T>(res?.Attributes)
        : res
    );
}

type PutItemsArgs = Partial<
  BatchWriteItemCommandInput & {
    TableName?: string;
  }
>;

/**
 * Inserts multiple items into the DynamoDB table.
 * @param items - The items to insert into the table.
 * @param args - The additional arguments to override or specify for {@link PutItemsArgs}
 * @returns A promise that resolves to an array of {@link BatchWriteItemCommandOutput}
 *
 * @example
 * Put multiple items into DynamoDB
 * ```javascript
 * await putItems([
 *   {
 *     PK: "User/1",
 *     SK: "Book/1",
 *     title: "The Great Gatsby",
 *     author: "F. Scott Fitzgerald",
 *     released: 1925,
 *   },
 *   // ... infinite more items (will be grouped into batches of 25 due to aws limit)
 * ]);
 * ```
 */
export async function putItems(
  items: DynamoDBItem[],
  args: PutItemsArgs = {},
  retry = 0
): Promise<BatchWriteItemCommandOutput[]> {
  if (retry > 3) return;

  args = withDefaults(args, "putItems");

  return new Promise(async (resolve, reject) => {
    const now = new Date().toISOString();

    const batches = splitEvery(
      items.map((item) => ({
        ...item,
        createdAt: item?.createdAt ?? now,
        createdAtISO: item?.createdAtISO ?? now,
      }))
    );
    const results = [];

    const table = args?.TableName || getDefaultTable();
    for (const batch of batches) {
      await getClient()
        .send(
          new BatchWriteItemCommand({
            RequestItems: {
              [table]: batch.map((item: any) => ({
                PutRequest: {
                  Item: marshallWithOptions(item),
                },
              })),
            },
            ...args,
          })
        )
        .then((res) => {
          results.push(res);

          if (res?.UnprocessedItems?.[table]?.length) {
            if (retry + 1 < 3) {
              reject(res);
              return;
            }

            return putItems(
              res.UnprocessedItems[table].map((item) =>
                unmarshallWithOptions(item.PutRequest.Item)
              ),
              { ...args, TableName: table },
              retry + 1
            );
          }
        })
        .catch(reject);
    }
    resolve(results);
  });
}
