import {
  ConditionCheck,
  Delete,
  ItemCollectionMetrics,
  Put,
  TransactWriteItem,
  TransactWriteItemsCommand,
  TransactWriteItemsCommandInput,
  Update,
} from "@aws-sdk/client-dynamodb";

import {
  getAttributeNames,
  getAttributeValues,
  getAttributesFromExpression,
  getClient,
  getDefaultTable,
  marshallWithOptions,
  stripKey,
  unmarshallWithOptions,
  withDefaults,
} from "../lib";

type TransactItem = {
  ConditionCheck?: Omit<ConditionCheck, "Key" | "TableName"> & {
    key: Record<string, any>;
    conditionData: Record<string, any>;
    TableName?: string;
  };
  Put?: Omit<Put, "Item" | "TableName"> & {
    item: Record<string, any>;
    TableName?: string;
    conditionData?: Record<string, any>;
  };
  Delete?: Omit<Delete, "Key" | "TableName"> & {
    key: Record<string, any>;
    conditionData?: Record<string, any>;
    TableName?: string;
  };
  Update?: Partial<Omit<Update, "Key" | "TableName">> & {
    key: Record<string, any>;
    updateData: Record<string, any>;
    conditionData?: Record<string, any>;
    TableName?: string;
  };
};

type TransactWriteItemsInput = Partial<
  Omit<TransactWriteItemsCommandInput, "TransactItems">
> & {
  TransactItems?: TransactWriteItem[];
  TableName?: string;
};

type ResponseItem = Pick<ItemCollectionMetrics, "SizeEstimateRangeGB"> & {
  Key: Record<string, any>;
};

export async function transactWriteItems(
  transactItems: TransactItem[],
  args: TransactWriteItemsInput = {}
): Promise<Record<string, ResponseItem[]>> {
  return new Promise(async (resolve, reject) => {
    args = withDefaults(args, "transactWriteItems");

    if (transactItems.length > 100) {
      throw new Error(
        "[@moicky/dynamodb]: TransactWriteItems can only handle up to 100 items"
      );
    }

    const now = Date.now();
    const table = args.TableName || getDefaultTable();

    const populatedItems = transactItems.map((item) => {
      if (item.ConditionCheck) {
        return handleConditionCheck(item.ConditionCheck, { now, table });
      } else if (item.Put) {
        return handlePutItem(item.Put, { now, table });
      } else if (item.Delete) {
        return handleDeleteItem(item.Delete, { now, table });
      } else if (item.Update) {
        return handleUpdateItem(item.Update, { now, table });
      } else {
        throw new Error(
          "[@moicky/dynamodb]: Invalid TransactItem: " + JSON.stringify(item)
        );
      }
    });

    return getClient()
      .send(
        new TransactWriteItemsCommand({
          TransactItems: populatedItems,
          ...args,
        })
      )
      .then((res) => {
        const results: Record<string, ResponseItem[]> = {};

        Object.entries(res.ItemCollectionMetrics || {}).forEach(
          ([tableName, metrics]) => {
            const unmarshalledMetrics = metrics.map((metric) => ({
              Key: unmarshallWithOptions(metric.ItemCollectionKey || {}),
              SizeEstimateRangeGB: metric.SizeEstimateRangeGB,
            }));

            if (!results[tableName]) {
              results[tableName] = [];
            }

            results[tableName].push(...unmarshalledMetrics);
          }
        );
        resolve(results);
      })
      .catch(reject);
  });
}

type BaseArgs = {
  now: number;
  table: string;
};

function handleExpressionAttributes(
  rest: {
    TableName?: string;
    ConditionExpression?: string;
  },
  data?: Record<string, any>
) {
  return {
    ExpressionAttributeValues: getAttributeValues(data || {}, {
      attributesToGet: getAttributesFromExpression(
        rest.ConditionExpression || "",
        ":"
      ),
    }),
    ExpressionAttributeNames: getAttributeNames(data || {}, {
      attributesToGet: getAttributesFromExpression(
        rest.ConditionExpression || ""
      ),
    }),
  };
}

function handleConditionCheck(
  params: TransactItem["ConditionCheck"],
  args: BaseArgs
): { ConditionCheck: TransactWriteItem["ConditionCheck"] } {
  const { key, conditionData, ...rest } = params;

  return {
    ConditionCheck: {
      Key: stripKey(key, { TableName: rest.TableName || args.table }),
      ...handleExpressionAttributes(rest, conditionData),
      ...rest,
      TableName: rest.TableName || args.table,
    },
  };
}

function handlePutItem(
  params: TransactItem["Put"],
  args: BaseArgs
): { Put: TransactWriteItem["Put"] } {
  const populatedData = structuredClone(params.item);
  populatedData.createdAt ??= args.now;

  const { item, conditionData, ...rest } = params;

  return {
    Put: {
      Item: marshallWithOptions(populatedData),
      ...handleExpressionAttributes(rest, conditionData),
      ...rest,
      TableName: rest.TableName || args.table,
    },
  };
}

function handleDeleteItem(
  params: TransactItem["Delete"],
  args: BaseArgs
): { Delete: TransactWriteItem["Delete"] } {
  const { key, conditionData, ...rest } = params;

  return {
    Delete: {
      Key: stripKey(key, { TableName: rest.TableName || args.table }),
      ...handleExpressionAttributes(rest, conditionData),
      ...rest,
      TableName: rest.TableName || args.table,
    },
  };
}

function handleUpdateItem(
  params: TransactItem["Update"],
  args: BaseArgs
): { Update: TransactWriteItem["Update"] } {
  const { key, updateData, conditionData, ...rest } = params;

  const populatedData = structuredClone(updateData);
  populatedData.updatedAt ??= args.now;

  const mergedData = { ...populatedData, ...conditionData };

  const UpdateExpression =
    "SET " +
    Object.keys(populatedData)
      .map((key) => `#${key} = :${key}`)
      .join(", ");

  return {
    Update: {
      Key: stripKey(key, { TableName: rest.TableName || args.table }),
      UpdateExpression,
      ExpressionAttributeValues: getAttributeValues(mergedData),
      ExpressionAttributeNames: getAttributeNames(
        {},
        {
          attributesToGet: getAttributesFromExpression(
            rest.ConditionExpression || ""
          ).concat(Object.keys(populatedData)),
        }
      ),
      ...rest,
      TableName: rest.TableName || args.table,
    },
  };
}
