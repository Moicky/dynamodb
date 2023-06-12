import { marshall } from "@aws-sdk/util-dynamodb";
import { getTableSchema } from "../lib/client";

// Since dynamo only accepts key atrtributes which are described in table schema
// we remove any other attributes from the item if they are present and passed as
// key parameter to any of the functions below (getItem, updateItem, deleteItem...)

export function stripKey(key: any, args?: { TableName?: string }) {
  const { hash, range } = getTableSchema(args?.TableName);
  return marshall({
    [hash]: key[hash],
    ...(range && { [range]: key[range] }),
  }) as Record<string, any>;
}

export function splitEvery<T>(items: T[], limit = 25) {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += limit) {
    batches.push(items.slice(i, i + limit));
  }
  return batches;
}

export function getAttributeValues(key: any, attributesToGet?: string[]) {
  return marshall(
    (attributesToGet || Object.keys(key)).reduce((acc, keyName) => {
      acc[`:${keyName}`] = key[keyName];
      return acc;
    }, {})
  ) as Record<string, any>;
}

export function getAttributeNames(key: any, attributesToGet?: string[]) {
  return (attributesToGet || Object.keys(key)).reduce((acc, keyName) => {
    acc[`#${keyName}`] = keyName;
    return acc;
  }, {} as Record<string, string>);
}

export function getAttributesFromExpression(expression: string, prefix = "#") {
  return (
    expression
      .match(new RegExp(`${prefix}\\w+`, "g"))
      ?.map((attr) => attr.slice(1)) || []
  );
}
