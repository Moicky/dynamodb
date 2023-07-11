import {
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  DeleteItemCommand,
  DeleteItemCommandInput,
  DeleteItemCommandOutput,
} from "@aws-sdk/client-dynamodb";

import { client, getDefaultTable, withDefaults } from "../lib/client";
import { splitEvery, stripKey } from "../lib/helpers";

export async function deleteItem(
  key: any,
  args: Partial<DeleteItemCommandInput> = {}
): Promise<DeleteItemCommandOutput> {
  return client.send(
    new DeleteItemCommand({
      Key: stripKey(key, args),
      ...withDefaults(args, "deleteItem"),
      TableName: args?.TableName || getDefaultTable(),
    })
  );
}

export async function deleteItems(
  keys: any[],
  args: Partial<
    BatchWriteItemCommandInput & {
      TableName?: string;
    }
  > = {},
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
      await client
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
            return deleteItems(res.UnprocessedItems[table], args, retry + 1);
          }
        })
        .catch(reject);
    }
    resolve();
  });
}
