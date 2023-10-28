import {
  Get,
  TransactGetItemsCommand,
  TransactGetItemsCommandInput,
  TransactGetItemsCommandOutput,
} from "@aws-sdk/client-dynamodb";

import {
  getClient,
  getDefaultTable,
  splitEvery,
  stripKey,
  unmarshallWithOptions,
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
): Promise<Array<Record<string, any> | undefined>> {
  return new Promise(async (resolve, reject) => {
    args = withDefaults(args, "transactGetItems");
    const { TableName, ...otherArgs } = args;

    const defaultTable = TableName || getDefaultTable();

    const batches = splitEvery(keys, 100);
    const results: TransactGetItemsCommandOutput[] = [];

    for (const batch of batches) {
      await getClient()
        .send(
          new TransactGetItemsCommand({
            TransactItems: batch.map((item) => {
              const table = item.TableName || defaultTable;
              return {
                Get: {
                  Key: stripKey(item.key, { TableName: table }),
                  TableName: table,
                  ExpressionAttributeNames: item.ExpressionAttributeNames,
                  ProjectionExpression: item.ProjectionExpression,
                },
              };
            }),
            ...otherArgs,
          })
        )
        .then((res) => results.push(res))
        .catch(reject);
    }

    resolve(
      results.flatMap(
        (result) =>
          result.Responses?.map((item) =>
            item?.Item ? unmarshallWithOptions(item.Item) : undefined
          ) || []
      )
    );
  });
}
