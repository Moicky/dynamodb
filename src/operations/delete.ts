import {
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  DeleteItemCommand,
  DeleteItemCommandInput,
  DeleteItemCommandOutput,
} from "@aws-sdk/client-dynamodb";

import { client, TableName } from "../lib/client";
import { splitEvery, stripKey } from "../lib/helpers";

export async function deleteItem(
  key: any,
  args: Partial<DeleteItemCommandInput> = {}
): Promise<DeleteItemCommandOutput> {
  return client.send(
    new DeleteItemCommand({
      TableName,
      Key: stripKey(key),
      ...args,
    })
  );
}

export async function deleteItems(
  keys: any[],
  args: Partial<BatchWriteItemCommandInput> = {},
  retry = 0
): Promise<void> {
  const uniqueKeys = Object.values(
    keys.reduce((acc, key) => {
      const strippedKey = stripKey(key);
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

    for (const batch of batches) {
      await client
        .send(
          new BatchWriteItemCommand({
            RequestItems: {
              [TableName]: batch.map((Key) => ({
                DeleteRequest: {
                  Key,
                },
              })),
            },
            ...args,
          })
        )
        .then((res) => {
          if (res?.UnprocessedItems?.[TableName]?.length) {
            if (retry + 1 > 3) return reject(res);
            return deleteItems(
              res.UnprocessedItems[TableName],
              args,
              retry + 1
            );
          }
        })
        .catch(reject);
    }
    resolve();
  });
}
