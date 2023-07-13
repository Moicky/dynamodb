import { GetItemCommand, GetItemCommandInput } from "@aws-sdk/client-dynamodb";

import {
  getClient,
  getDefaultTable,
  getTableSchema,
  stripKey,
  withDefaults,
} from "../lib";
import { queryItems } from "./query";

export async function itemExists(
  key: any,
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
