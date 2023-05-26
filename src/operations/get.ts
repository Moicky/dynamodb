import {
  BatchGetItemCommand,
  BatchGetItemCommandInput,
  GetItemCommand,
  GetItemCommandInput,
  ScanCommand,
  ScanCommandInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

import { client, TableName } from "../lib/client";
import { splitEvery, stripKey } from "../lib/helpers";

export async function getItem(
  key: any,
  args: Partial<GetItemCommandInput> = {}
) {
  return client
    .send(
      new GetItemCommand({
        TableName,
        Key: stripKey(key),
        ...args,
      })
    )
    .then((res) => res?.Item && unmarshall(res.Item));
}

export async function getItems(
  keys: any[],
  args: Partial<BatchGetItemCommandInput> = {},
  retry = 0
) {
  // creates batches of 100 items each and performs batchGet on every batch.
  // also retries up to 3 times if there are unprocessed items (due to size limit of 16MB)
  // returns items in same order as keys (not sorted by default when using batchGet)
  if (retry > 3) return [];
  const batchReadLimit = 100;
  // duplicate key entries would cause an error, so we remove them
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

  const batches = splitEvery(uniqueKeys, batchReadLimit);
  const results: Record<string, any> = [];

  if (retry > 2) {
    return results;
  }
  await Promise.all(
    batches.map(async (batch) => {
      await client
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
            return getItems(unprocessed.Keys, args, retry + 1).then((items) =>
              allItemsFromBatch.concat(items)
            );
          }
          return allItemsFromBatch.map((item) => item && unmarshall(item));
        })
        .then((items) => results.push(...items));
    })
  );
  const resultItems = results
    .filter((i: any) => i)
    .reduce((acc: Record<string, any>, item: any) => {
      const keyString = JSON.stringify(stripKey(item));
      acc[keyString] = item;
      return acc;
    }, {});

  return keys.map(
    (key) => resultItems[JSON.stringify(stripKey(key))] || undefined
  ) as (Record<string, any> | undefined)[];
}

export async function getAllItems(args: Partial<ScanCommandInput> = {}) {
  return client
    .send(
      new ScanCommand({
        TableName,
        ...args,
      })
    )
    .then((res) => res.Items.map((item) => item && unmarshall(item)));
}
