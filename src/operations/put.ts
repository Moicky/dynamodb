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
