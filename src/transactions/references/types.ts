import { DynamoDBItem } from "../../types";
import { DynamoDBItemKey, ItemWithKey } from "../types";

export type DynamoDBReference<T extends ItemWithKey = ItemWithKey> =
  T extends any[]
    ? never
    : {
        _type: "dynamodb:reference";
        _target: T;
        _refId: ReferenceMetadata["SK"];
      };

export type ResolvedItem<T extends DynamoDBItem> = {
  [Key in keyof T]: NonNullable<T[Key]> extends DynamoDBReference
    ? T[Key]["_target"] | undefined
    : NonNullable<T[Key]> extends Set<DynamoDBReference<infer T>>
    ? Set<T | undefined>
    : T[Key] extends object
    ? ResolvedItem<T[Key]>
    : T[Key];
};
export type WithoutReferences<T extends DynamoDBItem> = {
  [Key in keyof T as NonNullable<T[Key]> extends
    | DynamoDBReference
    | Set<DynamoDBReference>
    ? never
    : Key]: T[Key] extends object ? WithoutReferences<T[Key]> : T[Key];
};

export type ReferenceTo<T extends ItemWithKey> = T extends any[]
  ? void
  : DynamoDBReference<T>;

export type ReferenceMetadata = {
  PK: "dynamodb:reference";
  SK: string;
  item: DynamoDBItemKey;
  references: DynamoDBItemKey;
  onAttribute: string;
};
