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

/**
 * The internal _query function that executes the QueryCommand with given conditions and arguments.
 * @param keyCondition - The condition for the key in DynamoDB QueryCommand.
 * @param key - Definitions for the attributes used in keyCondition and FilterExpression
 * @param args - The additional arguments to override or specify for {@link QueryCommandInput}
 * @returns A promise that resolves to the output of {@link QueryCommandOutput}
 * @private
 */
async function _query(
  keyCondition: string,
  key: Record<string, any>,
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

/**
 * Query a single item in a DynamoDB table using a key condition.
 * @param keyCondition - The condition for the key in DynamoDB QueryCommand.
 * @param key - Definitions for the attributes used in keyCondition and FilterExpression
 * @param args - The additional arguments to override or specify for {@link QueryCommandInput}
 * @returns A promise that resolves to the output of {@link QueryCommandOutput}
 *
 * @example
 * Query a single item using a key condition
 * ```javascript
 * const booksResponse = await query("#PK = :PK and begins_with(#SK, :SK)", {
 *   PK: "User/1",
 *   SK: "Book/",
 * });
 * ```
 */
export async function query(
  keyCondition: string,
  key: Record<string, any>,
  args?: Partial<QueryCommandInput>
): Promise<QueryCommandOutput> {
  return _query(keyCondition, key, withDefaults(args, "query"));
}

/**
 * Query multiple items from the DynamoDB table using a key condition and unmarshalls the result.
 * @param keyCondition - The condition for the key in DynamoDB QueryCommand.
 * @param key - Definitions for the attributes used in keyCondition and FilterExpression
 * @param args - The additional arguments to override or specify for {@link QueryCommandInput}
 * @returns A promise that resolves to an array of unmarshalled items.
 *
 * @example
 * Query multiple items using a key condition
 * ```javascript
 * const books = await queryItems("#PK = :PK and begins_with(#SK, :SK)", {
 *   PK: "User/1",
 *   SK: "Book/",
 * });
 * ```
 */
export async function queryItems(
  keyCondition: string,
  key: Record<string, any>,
  args: Partial<QueryCommandInput> = {}
): Promise<Record<string, any>[]> {
  args = withDefaults(args, "queryItems");

  return _query(keyCondition, key, args).then((res) =>
    (res?.Items || [])
      .map((item) => item && unmarshallWithOptions(item))
      .filter((item) => item)
  );
}

/**
 * Query all items from the DynamoDB table using a key condition and unmarshalls the result.
 * This function retries until all items are retrieved due to the AWS limit of 1MB per query.
 * @param keyCondition - The condition for the key in DynamoDB QueryCommand.
 * @param key - Definitions for the attributes used in keyCondition and FilterExpression
 * @param args - The additional arguments to override or specify for {@link QueryCommandInput}
 * @returns A promise that resolves to an array of unmarshalled items.
 *
 * @example
 * Query all items using a key condition
 * ```javascript
 * const allBooks = await queryAllItems("#PK = :PK and begins_with(#SK, :SK)", {
 *   PK: "User/1",
 *   SK: "Book/",
 * });
 * const booksWithFilter = await queryAllItems(
 *   "#PK = :PK and begins_with(#SK, :SK)", // keyCondition
 *   {
 *     // definition for all attributes
 *     PK: "User/1",
 *     SK: "Book/",
 *     from: 1950,
 *     to: 2000,
 *   },
 *   // additional args with FilterExpression for example
 *   { FilterExpression: "#released BETWEEN :from AND :to" }
 * );
 * ```
 */
export async function queryAllItems(
  keyCondition: string,
  key: Record<string, any>,
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

/**
 * The structure for the PaginationPage type.
 * @property number - The page number. Cannot be set manually.
 * @property firstKey - The key for the first item on the page.
 * @property lastKey - The key for the last item on the page.
 */
export type PaginationPage = {
  number?: number; // Cannot be set manually
  firstKey: Record<string, any>;
  lastKey: Record<string, any>;
};

/**
 * The structure for the PaginationResult type.
 * @property items - The items on the current page.
 * @property hasPreviousPage - Whether there is a previous page.
 * @property hasNextPage - Whether there is a next page.
 * @property currentPage - The current page.
 */
export type PaginationResult = {
  items: Record<string, any>[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  currentPage: PaginationPage;
};

/**
 * The arguments for the queryPaginatedItems function.
 * @property pageSize - The size of each page.
 * @property direction - The direction of pagination, 'next' or 'previous'. Default is 'next'.
 * @property currentPage - The current page.
 */
export interface PaginationArgs
  extends Partial<Omit<QueryCommandInput, "Limit">> {
  pageSize: number;
  direction?: "next" | "previous";
  currentPage?: PaginationPage;
}

/**
 * Query items from the DynamoDB table using a key condition in a paginated manner.
 * @param keyCondition - The condition for the key in DynamoDB QueryCommand.
 * @param key - Definitions for the attributes used in keyCondition and FilterExpression
 * @param args- The pagination arguments, including pageSize and direction. {@link PaginationArgs}
 * @returns A promise that resolves to a {@link PaginationResult}.
 * @example
 * Query the first page of items using a key condition
 * ```javascript
 * const { items, hasNextPage, hasPreviousPage, currentPage } =
 *   await queryPaginatedItems(
 *     "#PK = :PK and begins_with(#SK, :SK)",
 *     { PK: "User/1", SK: "Book/" },
 *     { pageSize: 100 }
 *   );
 * // items: The items on the current page.
 * // currentPage: { number: 1, firstKey: { ... }, lastKey: { ... } }
 *
 * const { items: nextItems, currentPage: nextPage } = await queryPaginatedItems(
 *   "#PK = :PK and begins_with(#SK, :SK)",
 *   { PK: "User/1", SK: "Book/" },
 *   { pageSize: 100, currentPage }
 * );
 * // items: The items on the second page.
 * // currentPage: { number: 2, firstKey: { ... }, lastKey: { ... } }
 * ```
 */
export async function queryPaginatedItems(
  keyCondition: string,
  key: Record<string, any>,
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
