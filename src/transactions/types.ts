import { ConditionCheck, Delete, Put, Update } from "@aws-sdk/client-dynamodb";
import { DynamoDBItem } from "../types";

export type DynamoDBItemKey = {
  PK: string | number;
  SK?: string | number | undefined;
};
export type ItemWithKey = DynamoDBItem & DynamoDBItemKey;
export type WithoutKey<T> = Omit<T, keyof DynamoDBItemKey>;
export type OnlyKey<T extends DynamoDBItemKey> = Pick<T, keyof DynamoDBItemKey>;
export type Prettify<T> = { [key in keyof T]: T[key] } & {};

export type CreateOperation = {
  _type: "create";
  item: ItemWithKey;
  args?: Omit<Put, "Item">;
};
export type UpdateOperation = {
  _type: "update";
  item: DynamoDBItemKey;
  actions: Array<UpdateAction>;
  args?: Omit<Update, "Key" | "UpdateExpression">;
};
export type DeleteOperation = {
  _type: "delete";
  item: DynamoDBItemKey;
  args?: Omit<Delete, "Key">;
};
export type ConditionOperation = {
  _type: "condition";
  item: DynamoDBItemKey;
  args?: Omit<ConditionCheck, "Key">;
};

export type UpdateAction =
  | { _type: "set"; values: Record<string, any> }
  | { _type: "remove"; attributes: string[] }
  | { _type: "add"; values: Record<string, number | any[]> }
  | { _type: "delete"; values: Record<string, any[]> };

export type ItemOperation =
  | CreateOperation
  | UpdateOperation
  | DeleteOperation
  | ConditionOperation;

export type TypedParams<
  T extends DynamoDBItem,
  ValueType,
  ParamType = ValueType
> = {
  [Key in keyof T as NonNullable<T[Key]> extends ValueType
    ? Key
    : never]?: ParamType;
};
export type NestedParams<T = any> = Record<`${string}.${string}`, T>;
export type NestedTypedParams<
  T extends DynamoDBItem,
  ValueType,
  ParamType = ValueType
> = TypedParams<T, ValueType, ParamType> & NestedParams<ParamType>;

type Prev = [never, 0, 1, 2, 3];

type PathEntry = { path: string; type: any };

type DeepNumberPathEntries<
  T,
  Prefix extends string = "",
  D extends number = 3
> = [D] extends [never]
  ? never
  : {
      [K in keyof T & string]-?: NonNullable<T[K]> extends number
        ? { path: `${Prefix}${K}`; type: NonNullable<T[K]> }
        : NonNullable<T[K]> extends
            | any[]
            | Set<any>
            | Date
            | Function
            | Uint8Array
        ? never
        : NonNullable<T[K]> extends object
        ? DeepNumberPathEntries<NonNullable<T[K]>, `${Prefix}${K}.`, Prev[D]>
        : never;
    }[keyof T & string];

export type StrictDeepNumberUpdates<T> = {
  [Entry in DeepNumberPathEntries<T> &
    PathEntry as Entry["path"]]?: Entry["type"];
};

type DeepSetPathEntries<T, Prefix extends string = "", D extends number = 3> = [
  D
] extends [never]
  ? never
  : {
      [K in keyof T & string]-?: NonNullable<T[K]> extends
        | Set<infer E>
        | (infer E)[]
        ? { path: `${Prefix}${K}`; type: E }
        : NonNullable<T[K]> extends Date | Function | Uint8Array
        ? never
        : NonNullable<T[K]> extends object
        ? DeepSetPathEntries<NonNullable<T[K]>, `${Prefix}${K}.`, Prev[D]>
        : never;
    }[keyof T & string];

export type DeepSetUpdates<T> = {
  [Entry in DeepSetPathEntries<T> & PathEntry as Entry["path"]]?:
    | Entry["type"][]
    | Set<Entry["type"]>;
};
