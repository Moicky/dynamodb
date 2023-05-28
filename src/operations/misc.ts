import { GetItemCommandInput } from "@aws-sdk/client-dynamodb";

import { getItem } from "./get";
import { queryItems } from "./query";

export async function itemExists(
  key: any,
  args: Partial<GetItemCommandInput> = {}
) {
  const item = await getItem(key, args);
  return item !== undefined && item !== null;
}

export async function getNewId({
  PK,
  SK,
  length = 8,
}: {
  PK: string;
  SK?: string;
  length?: number;
}): Promise<string> {
  // Assumes that you are using SK as the incrementing ID
  if (!PK) {
    throw new Error("Cannot generate new ID: PK");
  }
  let lastId = "0";

  if (!SK) {
    const lastItem = (
      await queryItems(
        "#PK = :PK",
        { PK },
        { Limit: 1, ScanIndexForward: false }
      )
    )?.[0];
    const parts = lastItem?.["SK"]?.split("/") || [];
    lastId = parts?.[parts.length - 1] || "0";
  } else {
    const formattedSK = SK + (!SK.endsWith("/") ? "/" : "");
    const lastItem = (
      await queryItems(
        "#PK = :PK and begins_with(#SK, :SK)",
        { PK, SK: formattedSK },
        { Limit: 1, ScanIndexForward: false }
      )
    )?.[0];
    const parts = lastItem?.["SK"]?.split("/") || [];
    lastId = parts?.[formattedSK.split("/").length - 1] || "0";
  }
  const newId = parseInt(lastId) + 1 + "";
  const withPadding = newId.padStart(length || 0, "0");
  return withPadding;
}
