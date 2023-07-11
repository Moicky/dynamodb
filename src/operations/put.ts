import {
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  BatchWriteItemCommandOutput,
  PutItemCommand,
  PutItemCommandInput,
  PutItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

import { client, getDefaultTable, withDefaults } from "../lib/client";
import { splitEvery } from "../lib/helpers";

export async function putItem(
  data: any,
  args: Partial<PutItemCommandInput> = {}
): Promise<PutItemCommandOutput | Record<string, any>> {
  args = withDefaults(args, "putItem");

  if (!Object.keys(data).includes("createdAt")) {
    data.createdAt = Date.now();
  }
  return client
    .send(
      new PutItemCommand({
        Item: marshall(data),
        ...args,
        TableName: args?.TableName || getDefaultTable(),
      })
    )
    .then((res) => (args?.ReturnValues ? unmarshall(res?.Attributes) : res));
}

export async function putItems(
  items: any[],
  args: Partial<
    BatchWriteItemCommandInput & {
      TableName?: string;
    }
  > = {}
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
      await client
        .send(
          new BatchWriteItemCommand({
            RequestItems: {
              [table]: batch.map((item: any) => ({
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
