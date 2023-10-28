import {
  Get,
  TransactGetItemsCommand,
  TransactGetItemsCommandInput,
  TransactGetItemsCommandOutput,
} from "@aws-sdk/client-dynamodb";

import {
  getClient,
  getDefaultTable,
  marshallWithOptions,
  splitEvery,
  withDefaults,
} from "../lib";

export function transactGetItems(
  keys: Array<
    Omit<Get, "TableName" | "Key"> & {
      key: Record<string, any>;
      TableName?: string;
    }
  >,
  args?: Partial<
    TransactGetItemsCommandInput & {
      TableName?: string;
    }
  >
): Promise<TransactGetItemsCommandOutput[]> {
  return new Promise(async (resolve, reject) => {
    args = withDefaults(args, "transactGetItems");

    const TableName = args?.TableName || getDefaultTable();

    const batches = splitEvery(keys, 100);
    const results = [];

    for (const batch of batches) {
      await getClient()
        .send(
          new TransactGetItemsCommand({
            TransactItems: batch.map((item) => ({
              Get: { ...item, Key: marshallWithOptions(item), TableName },
            })),
            ...args,
          })
        )
        .then((res) => results.push(res))
        .catch(reject);
    }

    resolve(results);
  });
}
