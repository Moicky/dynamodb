import { marshallWithOptions } from "./config";
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

export function splitEvery<T>(items: T[], limit: number) {
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

export class ExpressionAttributes {
  nameMapping: Record<string, string> = {};
  valueMapping: Record<string, any> = {};

  nameCounter = 0;
  valueCounter = 0;

  constructor(
    public ExpressionAttributeValues: Record<string, any> = {},
    public ExpressionAttributeNames: Record<string, string> = {}
  ) {}

  appendNames(names: string[]) {
    names.forEach((name) => {
      const parts = name.split(".");
      parts.forEach((part) => {
        if (!this.nameMapping[part]) {
          const newName = `#${this.nameCounter++}`;
          this.nameMapping[part] = newName;
          this.ExpressionAttributeNames[newName] = part;
        }
      });
    });
  }
  appendValues(values: Record<string, any>) {
    Object.entries(values).forEach(([key, value]) => {
      const newValueName = `:${this.valueCounter++}`;
      this.valueMapping[key] = newValueName;
      this.ExpressionAttributeValues[newValueName] = value;
    });
  }
  appendBoth(values: Record<string, any>) {
    this.appendNames(Object.keys(values));
    this.appendValues(values);
  }

  getAttributes() {
    const marshalled = marshallWithOptions(this.ExpressionAttributeValues);
    return {
      ExpressionAttributeNames: this.ExpressionAttributeNames,
      ...(Object.keys(marshalled).length > 0 && {
        ExpressionAttributeValues: marshalled,
      }),
    };
  }
  getName(attributeName: string) {
    return attributeName
      .split(".")
      .map((part) => this.nameMapping[part])
      .join(".");
  }
  getValue(attributeName: string) {
    return this.valueMapping[attributeName];
  }
}

export const getItemKey = (
  item: Record<string, any>,
  args?: { TableName?: string }
) => {
  const { hash, range } = getTableSchema(args?.TableName);

  return JSON.stringify({
    [hash]: item[hash],
    ...(range && { [range]: item[range] }),
  });
};
