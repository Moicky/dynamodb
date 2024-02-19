import { GetItemCommand, GetItemCommandInput } from "@aws-sdk/client-dynamodb";

import {
  getClient,
  getDefaultTable,
  getTableSchema,
  stripKey,
  withDefaults,
} from "../lib";
import { DynamoDBItem } from "../types";
import { queryItems } from "./query";

/**
 * Check if an item exists in the DynamoDB table using its key schema.
 * @param key - The item with at least the partition key and the sort key (if applicable) of the item to check.
 * @param args - The additional arguments to override or specify for {@link GetItemCommandInput}
 * @returns A promise that resolves to a boolean indicating whether the item exists or not.
 *
 * @example
 * Check if an item exists
 * ```typescript
 * const exists = await itemExists({ PK: "User/1", SK: "Book/1" });
 * console.log(exists); // true / false
 * ```
 */
export async function itemExists(
  key: DynamoDBItem,
  args: Partial<GetItemCommandInput> = {}
) {
  args = withDefaults(args, "itemExists");

  return getClient()
    .send(
      new GetItemCommand({
        Key: stripKey(key, args),
        ...args,
        TableName: args?.TableName || getDefaultTable(),
      })
    )
    .then((res) => !!res?.Item);
}

/**
 * Generate an ascending ID for an item in the DynamoDB table using the key schema.
 * @param params - An object containing key schema information and optional ID length and TableName
 * @returns A promise that resolves to a string representing the new ascending ID.
 *
 * @example
 * Generate ascending ID
 * ```typescript
 * // Example Structure 1: PK: "User/1", SK: "{{ ASCENDING_ID }}"
 * // Last item: { PK: "User/1", SK: "00000009" }
 * const id1 = await getAscendingId({ PK: "User/1" });
 * console.log(id1); // "00000010"
 *
 * // Example Structure 2: PK: "User/1", SK: "Book/{{ ASCENDING_ID }}"
 * // Last item: { PK: "User/1", SK: "Book/00000009" }
 * const id2 = await getAscendingId({ PK: "User/1", SK: "Book" });
 * console.log(id2); // "00000010"
 *
 * // Specify length of ID
 * const id3 = await getAscendingId({ PK: "User/1", SK: "Book", length: 4 });
 * console.log(id3); // "0010"
 *
 * // Example Structure 3: someKeySchemaHash: "User/1", SK: "Book/{{ ASCENDING_ID }}"
 * // Last item: { someKeySchemaHash: "User/1", SK: "Book/00000009" }
 * const id4 = await getAscendingId({
 *   someKeySchemaHash: "User/1",
 *   SK: "Book",
 * });
 * console.log(id4); // "00000010"
 * ```
 */
export async function getAscendingId({
  length = 8,
  TableName,
  ...keySchema
}: {
  length?: number;
  TableName?: string;
  [keySchema: string]: any;
}): Promise<string> {
  // Assumes that you are the incrementing ID inside or as the keySchema range key

  const table = TableName || getDefaultTable();
  const { hash, range } = getTableSchema(table);

  const keySchemaHash = keySchema[hash];
  const keySchemaRange = keySchema[range];

  if (!keySchemaHash) {
    throw new Error(
      `[@moicky/dynamodb]: Cannot generate new ID: keySchemaHash is missing, expected '${hash}'`
    );
  }
  let lastId = "0";

  if (!keySchemaRange) {
    const lastItem = (
      await queryItems(
        `#${hash} = :${hash}`,
        { [hash]: keySchemaHash },
        { Limit: 1, ScanIndexForward: false, TableName: table }
      )
    )?.[0];
    const parts = lastItem?.[range]?.split("/") || [];
    lastId = parts?.[parts.length - 1] || "0";
  } else {
    const formattedSK =
      keySchemaRange + (!keySchemaRange.endsWith("/") ? "/" : "");
    const lastItem = (
      await queryItems(
        `#${hash} = :${hash} and begins_with(#${range}, :${range})`,
        { [hash]: keySchemaHash, [range]: formattedSK },
        { Limit: 1, ScanIndexForward: false, TableName: table }
      )
    )?.[0];
    const parts = lastItem?.[range]?.split("/") || [];
    lastId = parts?.[formattedSK.split("/").length - 1] || "0";
  }
  const newId = parseInt(lastId) + 1 + "";
  const withPadding = newId.padStart(length || 0, "0");
  return withPadding;
}
