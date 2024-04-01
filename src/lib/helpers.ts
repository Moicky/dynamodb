import { marshallWithOptions } from "./fixes";
import { getTableSchema } from "./schemas";

// Since dynamo only accepts key atrtributes which are described in table schema
// we remove any other attributes from the item if they are present and passed as
// key parameter to any of the functions below (getItem, updateItem, deleteItem...)

export function stripKey(
  key: Record<string, any>,
  args?: { TableName?: string }
) {
  const { hash, range } = getTableSchema(args?.TableName);
  return marshallWithOptions({
    [hash]: key[hash],
    ...(range && { [range]: key[range] }),
  });
}

export function splitEvery<T>(items: T[], limit = 25) {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += limit) {
    batches.push(items.slice(i, i + limit));
  }
  return batches;
}

export function getAttributeValues(
  key: Record<string, any>,
  {
    attributesToGet,
    prefix = ":",
  }: { attributesToGet?: string[]; prefix?: string } = {}
) {
  return marshallWithOptions(
    (attributesToGet || Object.keys(key)).reduce((acc, keyName) => {
      acc[`${prefix}${keyName}`] = key[keyName];
      return acc;
    }, {})
  );
}

export function getAttributeNames(
  key: Record<string, any>,
  {
    attributesToGet,
    prefix = "#",
  }: { attributesToGet?: string[]; prefix?: string } = {}
) {
  return (attributesToGet || Object.keys(key)).reduce<Record<string, string>>(
    (acc, keyName) => {
      acc[`${prefix}${keyName}`] = keyName;
      return acc;
    },
    {}
  );
}

export function getAttributesFromExpression(expression: string, prefix = "#") {
  return (
    expression
      .match(new RegExp(`${prefix}\\w+`, "g"))
      ?.map((attr) => attr.slice(1)) || []
  );
}
