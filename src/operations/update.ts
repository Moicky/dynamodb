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

/**
 * Updates an item in DynamoDB. All provided fields are overwritten.
 *
 * @param key - The primary key of the item to be updated
 * @param data - An object containing the data to be updated
 * @param args - Optional parameters for the {@link UpdateItemCommand}
 * @returns Returns updated item if ReturnValues argument is set, otherwise undefined
 *
 * @example
 * Update the item and overwrite all supplied fields
 * ```javascript
 * await updateItem(
 *   { PK: "User/1", SK: "Book/1" }, // reference to item
 *   { description: "A book about a rich guy", author: "F. Scott Fitzgerald" } // fields to update
 * );
 *
 * // Conditionally update an item. 'maxReleased' will not be updated since it is referenced inside the ConditionExpression
 * await updateItem(
 *   { PK: "User/1", SK: "Book/1" },
 *   { released: 2000, maxReleased: 1950 },
 *   { ConditionExpression: "#released < :maxReleased" }
 * );
 *
 * // Return all attributes of the new item
 * const newItem = await updateItem(
 *   { PK: "User/1", SK: "Book/1" },
 *   { released: 2000 },
 *   { ReturnValues: "ALL_NEW" }
 * );
 * console.log(newItem); // { "PK": "User/1", "SK": "Book/1", "released": 2000 }
 * ```
 */
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

/**
 * Removes specified attributes from an item in DynamoDB.
 *
 * @param key - The primary key of the item from which attributes should be removed
 * @param {string[]} attributes - Array of attribute names to be removed
 * @param args - Optional parameters for the {@link UpdateItemCommand}
 * @returns Promise object representing the output of the DynamoDB UpdateItem command
 *
 * @example
 * Remove a specific attribute from an item
 * ```javascript
 * await removeAttributes({ PK: "User/1", SK: "Book/1" }, ["description"]);
 * ```
 */
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
