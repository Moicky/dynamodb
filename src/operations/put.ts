import {
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  BatchWriteItemCommandOutput,
  PutItemCommand,
  PutItemCommandInput,
  PutItemCommandOutput,
} from "@aws-sdk/client-dynamodb";

import {
  getClient,
  getDefaultTable,
  marshallWithOptions,
  splitEvery,
  unmarshallWithOptions,
  withDefaults,
} from "../lib";

/**
 * Inserts an item into the DynamoDB table.
 * @param data - The item to insert into the table.
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
export async function putItem(
  data: any,
  args: Partial<PutItemCommandInput> = {}
): Promise<PutItemCommandOutput | Record<string, any>> {
  args = withDefaults(args, "putItem");

  if (!Object.keys(data).includes("createdAt")) {
    data.createdAt = Date.now();
  }
  return getClient()
    .send(
      new PutItemCommand({
        Item: marshallWithOptions(data),
        ...args,
        TableName: args?.TableName || getDefaultTable(),
      })
    )
    .then((res) =>
      args?.ReturnValues ? unmarshallWithOptions(res?.Attributes) : res
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
  items: any[],
  args: PutItemsArgs = {}
): Promise<BatchWriteItemCommandOutput[]> {
  args = withDefaults(args, "putItems");

  return new Promise(async (resolve, reject) => {
    const now = Date.now();

    const batches = splitEvery(
      items.map((item) => ({
        ...item,
        createdAt: item?.createdAt ?? now,
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
        .then((res) => results.push(res))
        .catch(reject);
    }
    resolve(results);
  });
}
