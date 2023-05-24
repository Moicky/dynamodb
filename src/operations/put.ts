import {
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  PutItemCommand,
  PutItemCommandInput,
  PutItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

import { client, TableName } from "../lib/client";
import { splitEvery } from "../lib/helpers";

export async function putItem(
  data: any,
  args: Partial<PutItemCommandInput> = {}
): Promise<PutItemCommandOutput> {
  if (!Object.keys(data).includes("createdAt")) {
    data.createdAt = Date.now();
  }
  return client.send(
    new PutItemCommand({
      TableName,
      Item: marshall(data),
      ...args,
    })
  );
}

export async function putItems(
  items: any[],
  args: Partial<BatchWriteItemCommandInput> = {}
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const batches = splitEvery(items);
    const now = Date.now();
    for (const batch of batches) {
      batch.forEach((item: any) => {
        if (!Object.keys(item).includes("createdAt")) {
          item.createdAt = now;
        }
      });
      await client
        .send(
          new BatchWriteItemCommand({
            RequestItems: {
              [TableName]: batch.map((item: any) => ({
                PutRequest: {
                  Item: marshall(item),
                },
              })),
            },
            ...args,
          })
        )
        .catch(reject);
    }
    resolve();
  });
}
