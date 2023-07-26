import {
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
} from "@aws-sdk/client-dynamodb";

import {
  getAttributeNames,
  getAttributeValues,
  getAttributesFromExpression,
  getClient,
  getDefaultTable,
  marshallWithOptions,
  unmarshallWithOptions,
  withDefaults,
  withFixes,
} from "../lib";

async function _query(
  keyCondition: string,
  key: any,
  args: Partial<QueryCommandInput> = {}
): Promise<QueryCommandOutput> {
  args = withFixes(args);

  return getClient().send(
    new QueryCommand({
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: getAttributeValues(key, [
        ...getAttributesFromExpression(keyCondition, ":"),
        ...getAttributesFromExpression(args?.FilterExpression || "", ":"),
      ]),
      ExpressionAttributeNames: getAttributeNames(key, [
        ...getAttributesFromExpression(keyCondition),
        ...getAttributesFromExpression(args?.FilterExpression || ""),
      ]),
      ...args,
      TableName: args?.TableName || getDefaultTable(),
    })
  );
}

export async function query(
  keyCondition: string,
  key: any,
  args?: Partial<QueryCommandInput>
): Promise<QueryCommandOutput> {
  return _query(keyCondition, key, withDefaults(args, "query"));
}

export async function queryItems(
  keyCondition: string,
  key: any,
  args: Partial<QueryCommandInput> = {}
): Promise<Record<string, any>[]> {
  args = withDefaults(args, "queryItems");

  return _query(keyCondition, key, args).then((res) =>
    (res?.Items || [])
      .map((item) => item && unmarshallWithOptions(item))
      .filter((item) => item)
  );
}

export async function queryAllItems(
  keyCondition: string,
  key: any,
  args: Partial<QueryCommandInput> = {}
): Promise<Record<string, any>[]> {
  args = withDefaults(args, "queryAllItems");

  let data = await _query(keyCondition, key, args);
  while (data.LastEvaluatedKey) {
    if (!Object.hasOwn(args, "Limit") || data.Items.length < args?.Limit) {
      let helper = await _query(keyCondition, key, {
        ...args,
        ExclusiveStartKey: data.LastEvaluatedKey,
      });
      if (helper?.Items) {
        data.Items.push(...helper.Items);
      } else {
        break;
      }
      data.LastEvaluatedKey = helper.LastEvaluatedKey;
    } else {
      break;
    }
  }
  return (data?.Items || [])
    .map((item) => item && unmarshallWithOptions(item))
    .filter(Boolean);
}

export type PaginationPage = {
  number?: number; // Cannot be set manually
  firstKey: Record<string, any>;
  lastKey: Record<string, any>;
};

export type PaginationResult = {
  items: Record<string, any>[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  currentPage: PaginationPage;
};

export interface PaginationArgs
  extends Partial<Omit<QueryCommandInput, "Limit">> {
  pageSize: number;
  direction?: "next" | "previous"; // default: 'next'
  currentPage?: PaginationPage;
}

export async function queryPaginatedItems(
  keyCondition: string,
  key: any,
  args: PaginationArgs
): Promise<PaginationResult> {
  args = withDefaults(args, "queryPaginatedItems");

  const pageSize = args.pageSize;
  const direction = args.direction || "next";
  const currentPage = args.currentPage;

  delete args.pageSize;
  delete args.direction;
  delete args.currentPage;

  const queryArgs: Partial<QueryCommandInput> = {
    ...args,
    Limit: pageSize,
    ScanIndexForward: direction === "next",
  };

  let newPageNumber: number;
  switch (direction) {
    case "next":
      if (currentPage?.lastKey) {
        queryArgs.ExclusiveStartKey = marshallWithOptions(currentPage.lastKey);
      }
      newPageNumber = (currentPage?.number || 0) + 1;
      break;
    case "previous":
      if (currentPage?.firstKey) {
        queryArgs.ExclusiveStartKey = marshallWithOptions(currentPage.firstKey);
      }
      newPageNumber = (currentPage?.number || 2) - 1;
      break;
  }

  let data = await _query(keyCondition, key, queryArgs);

  // Assume schema for either given index or the table's schema
  const keyAttributes = Object.keys(
    data.LastEvaluatedKey || queryArgs.ExclusiveStartKey || {}
  );
  while (data.LastEvaluatedKey) {
    if (data.Items.length < pageSize) {
      let helper = await _query(keyCondition, key, {
        ...queryArgs,
        ExclusiveStartKey: data.LastEvaluatedKey,
      });
      if (helper?.Items) {
        data.Items.push(...helper.Items);
      } else {
        break;
      }
      data.LastEvaluatedKey = helper.LastEvaluatedKey;
    } else {
      break;
    }
  }

  let hasNextPage =
    direction === "previous" ||
    // If pagination matches exactly with total items, dynamodb still returns a LastEvaluatedKey even tho next page is empty
    // Therefore we check if the next page actually has items
    (!!data.LastEvaluatedKey &&
      (await _query(keyCondition, key, {
        ...queryArgs,
        Limit: 1,
        ExclusiveStartKey: data.LastEvaluatedKey,
      }).then(({ Count }) => Count > 0)));
  let hasPreviousPage = newPageNumber > 1;

  data.Items = data.Items || [];
  direction === "previous" && data.Items.reverse();

  const applySchema = (item: Record<string, any>) => {
    return keyAttributes.reduce(
      (acc, key) => ({ ...acc, [key]: item[key] }),
      {}
    );
  };

  const firstItem = data.Items?.[0];
  const lastItem = data.Items?.[data.Items?.length - 1];

  const firstKey = firstItem && unmarshallWithOptions(applySchema(firstItem));
  const lastKey = lastItem && unmarshallWithOptions(applySchema(lastItem));

  const items = data.Items.map(
    (item) => item && unmarshallWithOptions(item)
  ).filter(Boolean);

  return {
    items,
    hasPreviousPage,
    hasNextPage,
    currentPage: {
      number: newPageNumber,
      firstKey,
      lastKey,
    },
  };
}
