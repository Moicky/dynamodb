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
  getConfig,
  getDefaultTable,
  getItemModificationTimestamp,
  marshallWithOptions,
  splitEvery,
  stripKey,
  unmarshallWithOptions,
  withDefaults,
} from "../lib";

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html
const OPERATIONS_LIMIT = 100;

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

/**
 * Performs a TransactWriteItems operation against DynamoDB. This allows you to perform multiple write operations in a single transaction.
 * @param transactItems - Array of items to transact. Each item can be a Put, Update, Delete, or ConditionCheck operation.
 * @param args - The additional arguments to override or specify for {@link TransactWriteItemsCommandInput}
 * @returns A promise that resolves to a record of response items
 *
 * @example
 * Perform a TransactWriteItems operation
 * ```javascript
 * const response = await transactWriteItems([
 *   {
 *     Put: {
 *       item: {
 *         PK: "User/1",
 *         SK: "Book/1",
 *         title: "The Great Gatsby",
 *         author: "F. Scott Fitzgerald",
 *         released: 1925,
 *       },
 *     },
 *   },
 *   {
 *     Update: {
 *       key: { PK: "User/1", SK: "Book/1" },
 *       updateData: { title: "The Great Gatsby - Updated" },
 *     },
 *   },
 *   {
 *     Delete: {
 *       key: { PK: "User/1", SK: "Book/1" },
 *     },
 *   },
 *   {
 *     ConditionCheck: {
 *       key: { PK: "User/1", SK: "Book/1" },
 *       ConditionExpression: "#title = :title",
 *       conditionData: { title: "The Great Gatsby" },
 *     },
 *   },
 * ]);
 *
 * console.log(response);
 * ```
 */
export async function transactWriteItems(
  transactItems: TransactItem[],
  args: TransactWriteItemsInput = {}
): Promise<Record<string, ResponseItem[]>> {
  return new Promise(async (resolve, reject) => {
    args = withDefaults(args, "transactWriteItems");

    const table = args.TableName || getDefaultTable();
    const shouldSplitTransactions =
      getConfig().splitTransactionsIfAboveLimit ?? false;

    if (
      transactItems.length === 0 ||
      (transactItems.length > OPERATIONS_LIMIT && !shouldSplitTransactions)
    ) {
      reject(new Error("[@moicky/dynamodb]: Invalid number of operations"));
    }

    const conditionCheckItems = transactItems
      .filter((item) => item.ConditionCheck)
      .map((item) => handleConditionCheck(item.ConditionCheck, { table }));

    let createdAt: any = null;
    let updatedAt: any = null;

    const operationItems = transactItems
      .filter((item) => !item.ConditionCheck)
      .map((item) => {
        if (item.Put) {
          createdAt ??= getItemModificationTimestamp("createdAt");
          return handlePutItem(item.Put, { createdAt, table });
        } else if (item.Delete) {
          return handleDeleteItem(item.Delete, { table });
        } else if (item.Update) {
          updatedAt ??= getItemModificationTimestamp("updatedAt");
          return handleUpdateItem(item.Update, { updatedAt, table });
        } else {
          reject(
            new Error(
              "[@moicky/dynamodb]: Invalid TransactItem: " +
                JSON.stringify(item)
            )
          );
        }
      });

    const availableSlots = OPERATIONS_LIMIT - conditionCheckItems.length;
    const batches = splitEvery(operationItems, availableSlots);

    const results: Record<string, ResponseItem[]> = {};
    for (const batch of operationItems?.length ? batches : [[]]) {
      const populatedItems = [...conditionCheckItems, ...batch];

      await getClient()
        .send(
          new TransactWriteItemsCommand({
            TransactItems: populatedItems,
            ...args,
          })
        )
        .then((res) => {
          Object.entries(res.ItemCollectionMetrics || {}).forEach(
            ([tableName, metrics]) => {
              const unmarshalledMetrics = metrics.map((metric) => ({
                Key: unmarshallWithOptions(metric.ItemCollectionKey || {}),
                SizeEstimateRangeGB: metric.SizeEstimateRangeGB,
              }));

              results[tableName] ??= [];
              results[tableName].push(...unmarshalledMetrics);
            }
          );
        })
        .catch(reject);
    }

    return resolve(results);
  });
}

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
  args: { table: string }
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
  args: { table: string; createdAt: number | string }
): { Put: TransactWriteItem["Put"] } {
  const populatedData = structuredClone(params.item);

  if (!Object.keys(populatedData).includes("createdAt")) {
    populatedData.createdAt = args.createdAt;
  }

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
  args: { table: string }
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
  args: { table: string; updatedAt: number | string }
): { Update: TransactWriteItem["Update"] } {
  const { key, updateData, conditionData, ...rest } = params;

  const populatedData = structuredClone(updateData);
  if (!Object.keys(populatedData).includes("updatedAt")) {
    populatedData.updatedAt = args.updatedAt;
  }

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
