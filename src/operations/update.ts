import {
  UpdateItemCommand,
  UpdateItemCommandInput,
  UpdateItemCommandOutput,
} from "@aws-sdk/client-dynamodb";

import { client, TableName } from "../lib/client";
import {
  getAttributeNames,
  getAttributesFromExpression,
  getAttributeValues,
  stripKey,
} from "../lib/helpers";
import { unmarshall } from "@aws-sdk/util-dynamodb";

export async function updateItem(
  key: any,
  data: any,
  args: Partial<UpdateItemCommandInput> = {}
): Promise<undefined | Record<string, any>> {
  if (!Object.keys(data).includes("updatedAt")) {
    data.updatedAt = Date.now();
  }

  const valuesInCondition = getAttributesFromExpression(
    args?.ConditionExpression || "",
    ":"
  );
  const namesInCondition = getAttributesFromExpression(
    args?.ConditionExpression || ""
  );

  const attributesToUpdate = Object.keys(data).filter(
    (key) => !valuesInCondition.includes(key)
  );

  const UpdateExpression =
    "SET " + attributesToUpdate.map((key) => `#${key} = :${key}`).join(", ");

  return client
    .send(
      new UpdateItemCommand({
        TableName,
        Key: stripKey(key),
        UpdateExpression,
        ExpressionAttributeValues: getAttributeValues(data, [
          ...attributesToUpdate,
          ...valuesInCondition,
        ]),
        ExpressionAttributeNames: getAttributeNames(data, [
          ...attributesToUpdate,
          ...namesInCondition,
        ]),
        ...args,
      })
    )
    .then((res) =>
      args?.ReturnValues ? unmarshall(res.Attributes) : undefined
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
