import {
  TransactWriteItem,
  TransactWriteItemsCommand,
  TransactWriteItemsCommandInput,
  TransactWriteItemsCommandOutput,
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
  ConditionCheck?: Omit<
    TransactWriteItem["ConditionCheck"],
    "Key" | "TableName"
  > & {
    key: Record<string, any>;
    conditionData: Record<string, any>;
    TableName?: string;
  };
  Put?: Omit<TransactWriteItem["Put"], "Item" | "TableName"> & {
    item: Record<string, any>;
    TableName?: string;
    conditionData?: Record<string, any>;
  };
  Delete?: Omit<TransactWriteItem["Delete"], "Key" | "TableName"> & {
    key: Record<string, any>;
    conditionData?: Record<string, any>;
    TableName?: string;
  };
  Update?: Omit<TransactWriteItem["Update"], "Key" | "TableName"> & {
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
        throw new Error("Invalid TransactItem");
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

function handleBaseArgs(
  rest: {
    TableName?: string;
    ConditionExpression?: string;
  },
  args: BaseArgs,
  conditionData?: Record<string, any>
) {
  return {
    TableName: rest.TableName || args.table,
    ExpressionAttributeValues: getAttributeValues(
      conditionData || {},
      getAttributesFromExpression(rest.ConditionExpression || "", ":")
    ),
    ExpressionAttributeNames: getAttributeNames(
      conditionData || {},
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
      ...rest,
      ...handleBaseArgs(rest, args, conditionData),
      Key: marshallWithOptions(key),
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
      ...rest,
      ...handleBaseArgs(rest, args, conditionData),
      Item: marshallWithOptions(params.item),
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
      ...rest,
      ...handleBaseArgs(rest, args, conditionData),
      Key: marshallWithOptions(key),
    },
  };
}

function handleUpdateItem(
  params: TransactItem["Update"],
  args: BaseArgs
): { Update: TransactWriteItem["Update"] } {
  params.updateData.updatedAt ??= args.now;

  const { key, updateData, conditionData, ...rest } = params;
  const mergedData = { ...updateData, ...conditionData };

  return {
    Update: {
      ...rest,
      TableName: rest.TableName || args.table,
      Key: marshallWithOptions(key),
      ExpressionAttributeValues: getAttributeValues(mergedData),
      ExpressionAttributeNames: getAttributeNames(mergedData),
    },
  };
}
