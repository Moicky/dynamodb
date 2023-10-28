import {
  ConditionCheck,
  Delete,
  Put,
  TransactWriteItem,
  TransactWriteItemsCommand,
  TransactWriteItemsCommandInput,
  TransactWriteItemsCommandOutput,
  Update,
} from "@aws-sdk/client-dynamodb";

import {
  getAttributeNames,
  getAttributeValues,
  getAttributesFromExpression,
  getClient,
  getDefaultTable,
  marshallWithOptions,
  splitEvery,
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
  Update?: Omit<Update, "Key" | "TableName"> & {
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

export async function transactWriteItems(
  transactItems: TransactItem[],
  args: TransactWriteItemsInput = {}
): Promise<TransactWriteItemsCommandOutput[]> {
  return new Promise(async (resolve, reject) => {
    args = withDefaults(args, "transactWriteItems");

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

    const batches = splitEvery(populatedItems, 100);
    const results = [];

    for (const batch of batches) {
      // should probably not be parallel due to conditions & atomicity
      await getClient()
        .send(new TransactWriteItemsCommand({ TransactItems: batch, ...args }))
        .then((res) => results.push(res))
        .catch(reject);
    }

    resolve(results);
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
    ExpressionAttributeValues: getAttributeValues(
      data || {},
      getAttributesFromExpression(rest.ConditionExpression || "", ":")
    ),
    ExpressionAttributeNames: getAttributeNames(
      data || {},
      getAttributesFromExpression(rest.ConditionExpression || "")
    ),
  };
}

function handleConditionCheck(
  params: TransactItem["ConditionCheck"],
  args: BaseArgs
): { ConditionCheck: TransactWriteItem["ConditionCheck"] } {
  const { key, conditionData, ...rest } = params;

  return {
    ConditionCheck: {
      Key: marshallWithOptions(key),
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
  params.item.createdAt ??= args.now;

  const { item, conditionData, ...rest } = params;

  return {
    Put: {
      Item: marshallWithOptions(params.item),
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
      Key: marshallWithOptions(key),
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
  const mergedData = { ...updateData, ...conditionData };

  updateData.updatedAt ??= args.now;

  const UpdateExpression =
    "SET " +
    Object.keys(updateData)
      .map((key) => `#${key} = :${key}`)
      .join(", ");

  return {
    Update: {
      Key: marshallWithOptions(key),
      UpdateExpression,
      ExpressionAttributeValues: getAttributeValues(mergedData),
      ExpressionAttributeNames: getAttributeNames(mergedData),
      ...rest,
      TableName: rest.TableName || args.table,
    },
  };
}
