import { Transaction } from ".";
import {
  getAttributeNames,
  getAttributeValues,
  getAttributesFromExpression,
  getItemKey,
} from "../lib";
import { DynamoDBItem } from "../types";
import { createReference } from "./references";
import { DynamoDBReference } from "./references/types";
import {
  ConditionOperation,
  CreateOperation,
  DeepSetUpdates,
  DynamoDBItemKey,
  ItemWithKey,
  NestedParams,
  Prettify,
  StrictDeepNumberUpdates,
  TypedParams,
  UpdateOperation,
  WithoutKey,
} from "./types";

export class CreateOperations<U extends ItemWithKey> {
  constructor(
    private operation: CreateOperation,
    private transaction: Transaction
  ) {}

  setReferences(refs: SetReferencesParams<U>) {
    Object.entries(arraysToSets(refs)).forEach(([attributeName, ref]) => {
      if (!ref) return;

      const refArgs = {
        item: this.operation.item,
        onAttribute: attributeName,
      };

      const refData =
        ref instanceof Set
          ? [...ref].map((references) =>
              createReference({ references, ...refArgs }, this.transaction)
            )
          : createReference({ references: ref, ...refArgs }, this.transaction);

      const parts = attributeName.split(".");
      parts.reduce((acc, part, index) => {
        if (index === parts.length - 1) {
          acc[part] = refData;
        } else {
          acc[part] = acc[part] || {};
          return acc[part];
        }
      }, this.operation.item);
    });
  }
}

export class UpdateOperations<U extends DynamoDBItem> {
  constructor(
    private operation: UpdateOperation,
    private transaction: Transaction
  ) {}

  setReferences(refs: SetReferencesParams<U>) {
    Object.entries(arraysToSets(refs)).forEach(([attributeName, ref]) => {
      if (!ref) return;

      const refArgs = {
        item: this.operation.item,
        onAttribute: attributeName,
      };

      this.operation.actions.push({
        _type: "set",
        values: {
          [attributeName]:
            ref instanceof Set
              ? [...ref].map((references) =>
                  createReference({ references, ...refArgs }, this.transaction)
                )
              : createReference(
                  { references: ref, ...refArgs },
                  this.transaction
                ),
        },
      });
    });
  }
  set(values: WithoutKey<Partial<U>> & NestedParams) {
    if (Object.keys(values).length === 0) return this;

    this.operation.actions.push({ _type: "set", values });
    return this;
  }
  adjustNumber(values: Prettify<StrictDeepNumberUpdates<U>>) {
    if (Object.keys(values).length === 0) return this;

    this.operation.actions.push({ _type: "add", values: values as any });
    return this;
  }
  removeAttributes(...attributes: string[]) {
    if (attributes.length === 0) return this;
    this.operation.actions.push({ _type: "remove", attributes });
    return this;
  }

  addItemsToSet(values: Prettify<DeepSetUpdates<U>>) {
    if (Object.keys(values).length === 0) return this;

    this.operation.actions.push({
      _type: "add",
      values: arraysToSets(values as Record<string, Set<any>>),
    });
    return this;
  }
  deleteItemsFromSet(values: Prettify<DeepSetUpdates<U>>) {
    if (Object.keys(values).length === 0) return this;

    this.operation.actions.push({
      _type: "delete",
      values: arraysToSets(values as Record<string, Set<any> | any[]>),
    });
    return this;
  }

  onCondition({
    expression,
    values,
  }: {
    expression: string;
    values: Partial<U> & Record<string, any>;
  }) {
    this.operation.args = {
      ...this.operation.args,
      ConditionExpression: expression,
      ExpressionAttributeNames: getAttributeNames(values, {
        attributesToGet: getAttributesFromExpression(expression),
      }),
      ExpressionAttributeValues: getAttributesFromExpression(
        expression,
        ":"
      ).reduce((acc, keyName) => {
        acc[`:${keyName}`] = values[keyName];
        return acc;
      }, {}),
    };
  }
}

export class ConditionOperations<U extends DynamoDBItem> {
  constructor(
    private operations: Transaction["operations"],
    private item: DynamoDBItemKey,
    private args: Partial<ConditionOperation["args"]> & { TableName: string }
  ) {}

  matches({
    expression,
    values,
  }: {
    expression: string;
    values: Partial<U> & Record<string, any>;
  }) {
    if (Object.keys(values).length === 0) {
      throw new Error(
        "[@moicky/dynamodb]: No values in ConditionCheck provided"
      );
    }

    const itemKey = getItemKey(this.item, this.args);
    this.operations[itemKey] = {
      _type: "condition",
      item: this.item,
      args: {
        ConditionExpression: expression,
        ExpressionAttributeNames: getAttributeNames(values),
        ExpressionAttributeValues: getAttributeValues(values),
        ...this.args,
      },
    };
  }
}

const arraysToSets = <T extends DynamoDBItemKey>(
  values: Record<string, T | Set<T> | Array<T>>
): Record<string, T | Set<T>> => {
  return Object.entries(values).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]:
        value instanceof Set
          ? value
          : Array.isArray(value)
          ? new Set(value)
          : value,
    }),
    {}
  );
};

type SetReferencesParams<U extends DynamoDBItem> = TypedParams<
  U,
  DynamoDBReference,
  DynamoDBItemKey
> &
  TypedParams<
    U,
    Set<DynamoDBReference>,
    DynamoDBItemKey[] | Set<DynamoDBItemKey>
  > &
  NestedParams<DynamoDBItemKey | DynamoDBItemKey[] | Set<DynamoDBItemKey>>;
