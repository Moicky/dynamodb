import {
  UpdateItemCommand,
  UpdateItemCommandInput,
  UpdateItemCommandOutput,
} from "@aws-sdk/client-dynamodb";

import {
  getAttributeNames,
  getAttributeValues,
  getAttributesFromExpression,
  getClient,
  getDefaultTable,
  stripKey,
  unmarshallWithOptions,
  withDefaults,
} from "../lib";

export async function updateItem(
  key: any,
  data: any,
  args: Partial<UpdateItemCommandInput> = {}
): Promise<undefined | Record<string, any>> {
  args = withDefaults(args, "updateItem");

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

  return getClient()
    .send(
      new UpdateItemCommand({
        Key: stripKey(key, args),
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
        TableName: args?.TableName || getDefaultTable(),
      })
    )
    .then((res) =>
      args?.ReturnValues ? unmarshallWithOptions(res.Attributes) : undefined
    );
}

export async function removeAttributes(
  key: any,
  attributes: string[],
  args: Partial<UpdateItemCommandInput> = {}
): Promise<UpdateItemCommandOutput> {
  args = withDefaults(args, "removeAttributes");

  const UpdateExpression =
    "REMOVE " + attributes.map((att) => `#${att}`).join(", ");

  return getClient().send(
    new UpdateItemCommand({
      Key: stripKey(key, args),
      UpdateExpression,
      ExpressionAttributeNames: getAttributeNames(
        attributes.reduce((acc, att) => {
          acc[att] = att;
          return acc;
        }, {})
      ),
      ...args,
      TableName: args?.TableName || getDefaultTable(),
    })
  );
}
