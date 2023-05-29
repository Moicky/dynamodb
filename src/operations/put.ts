import {
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  BatchWriteItemCommandOutput,
  PutItemCommand,
  PutItemCommandInput,
  PutItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

import { client, TableName } from "../lib/client";
import { splitEvery } from "../lib/helpers";

export async function putItem(
  data: any,
  args: Partial<PutItemCommandInput> = {}
): Promise<PutItemCommandOutput | Record<string, any>> {
  if (!Object.keys(data).includes("createdAt")) {
    data.createdAt = Date.now();
  }
  return client
    .send(
      new PutItemCommand({
        TableName,
        Item: marshall(data),
        ...args,
      })
    )
    .then((res) => (args?.ReturnValues ? unmarshall(res?.Attributes) : res));
}

export async function putItems(
  items: any[],
  args: Partial<BatchWriteItemCommandInput> = {}
): Promise<BatchWriteItemCommandOutput[]> {
  return new Promise(async (resolve, reject) => {
    const now = Date.now();

    const batches = splitEvery(
      items.map((item) => ({
        ...item,
        createdAt: item?.createdAt ?? now,
      }))
    );
    const results = [];

    for (const batch of batches) {
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
        .then((res) => results.push(res))
        .catch(reject);
    }
    resolve(results);
  });
}
