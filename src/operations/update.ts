import {
  UpdateItemCommand,
  UpdateItemCommandInput,
  UpdateItemCommandOutput,
} from "@aws-sdk/client-dynamodb";

import { client, TableName } from "../lib/client";
import {
  getAttributeNames,
  getAttributeValues,
  stripKey,
} from "../lib/helpers";

export async function updateItem(
  key: any,
  data: any,
  args: Partial<UpdateItemCommandInput> = {}
): Promise<UpdateItemCommandOutput> {
  if (!Object.keys(data).includes("updatedAt")) {
    data.updatedAt = Date.now();
  }
  const UpdateExpression =
    "SET " +
    Object.keys(data)
      .map((key) => `#${key} = :${key}`)
      .join(", ");
  return client.send(
    new UpdateItemCommand({
      TableName,
      Key: stripKey(key),
      UpdateExpression,
      ExpressionAttributeValues: getAttributeValues(data),
      ExpressionAttributeNames: getAttributeNames(data),
      ...args,
    })
  );
}

export async function removeAttributes(
  key: any,
  attributes: string[]
): Promise<UpdateItemCommandOutput> {
  const UpdateExpression =
    "REMOVE " + attributes.map((att) => `#${att}`).join(", ");

  return client.send(
    new UpdateItemCommand({
      TableName,
      Key: stripKey(key),
      UpdateExpression,
      ExpressionAttributeNames: getAttributeNames(
        attributes.reduce((acc, att) => {
          acc[att] = att;
          return acc;
        }, {})
      ),
    })
  );
}
