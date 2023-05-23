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
  retries = 0
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const batches = splitEvery(keys);

    if (retries > 3) return;

    for (const batch of batches) {
      await client
        .send(
          new BatchWriteItemCommand({
            RequestItems: {
              [TableName]: batch.map((key: any) => ({
                DeleteRequest: {
                  Key: stripKey(key),
                },
              })),
            },
            ...args,
          })
        )
        .then((res) => {
          if (res?.UnprocessedItems?.[TableName]?.length) {
            if (retries + 1 > 3) return reject(res);
            return deleteItems(
              res.UnprocessedItems[TableName],
              args,
              retries + 1
            );
          }
        })
        .catch(reject);
    }
    resolve();
  });
}
