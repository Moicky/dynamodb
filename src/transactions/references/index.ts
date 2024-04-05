import { randomUUID } from "crypto";
import { Transaction } from "..";
import { getItems, putItem, queryAllItems } from "../../operations";
import { DynamoDBItem } from "../../types";
import { DynamoDBItemKey, ItemWithKey } from "../types";
import { DynamoDBReference, ReferenceMetadata, ResolvedItem } from "./types";

export const createReference = (
  ref: Pick<ReferenceMetadata, "item" | "references" | "onAttribute">,
  transaction: Transaction
): DynamoDBReference => {
  const { item, references, onAttribute } = ref;

  const referenceKey = {
    PK: references.PK,
    ...(references.SK && { SK: references.SK }),
  };

  const referenceItem: ReferenceMetadata = {
    PK: "dynamodb:reference",
    SK: randomUUID(),
    item: {
      PK: item.PK,
      ...(item.SK && { SK: item.SK }),
    },
    references: referenceKey,
    onAttribute,
  };

  transaction.create(referenceItem);

  return {
    _type: "dynamodb:reference",
    _target: referenceKey,
    _refId: referenceItem.SK,
  } satisfies DynamoDBReference;
};

const itemToStringKey = (item: ItemWithKey) => `${item.PK}#|#${item.SK}`;

const getRefsToResolve = (item: any) => {
  const refs: DynamoDBItemKey[] = [];

  if (!item) return refs;
  if (typeof item !== "object") return refs;
  if (item?._type === "dynamodb:reference") return [item?._target];

  for (const value of Object.values<DynamoDBReference>(item)) {
    if (typeof value === "object") {
      if (value instanceof Set || Array.isArray(value)) {
        refs.push(...[...value].map((v) => getRefsToResolve(v)).flat());
      } else if (value?._type === "dynamodb:reference") {
        refs.push(value?._target);
      } else {
        refs.push(...getRefsToResolve(value));
      }
    }
  }

  return refs;
};
const injectRefs = (item: any, refs: Record<string, ItemWithKey>) => {
  if (!item) return item;
  if (typeof item !== "object") return item;
  if (item?._type === "dynamodb:reference") {
    return refs[itemToStringKey(item._target)];
  }

  for (const [key, value] of Object.entries<DynamoDBReference>(item)) {
    if (typeof value === "object") {
      if (value instanceof Set || Array.isArray(value)) {
        item[key] = new Set([...value].map((v) => injectRefs(v, refs)));
      } else if (value?._type === "dynamodb:reference") {
        item[key] = refs[itemToStringKey(value._target)];
      } else {
        item[key] = injectRefs(value, refs);
      }
    }
  }

  return item;
};
export const createCustomReference = async (
  baseItem: DynamoDBItemKey,
  references: DynamoDBItemKey,
  onAttribute?: string
) =>
  putItem(
    {
      PK: "dynamodb:reference",
      SK: randomUUID(),
      item: {
        PK: baseItem.PK,
        ...(baseItem.SK && { SK: baseItem.SK }),
      },
      references: {
        PK: references.PK,
        ...(references.SK && { SK: references.SK }),
      },
      onAttribute: onAttribute || "",
    } satisfies ReferenceMetadata,
    { ReturnValues: "ALL_NEW" }
  );

export const resolveReferences = async <T extends DynamoDBItem>(
  item: T
): Promise<ResolvedItem<T>> => {
  const resolvedItem = structuredClone<any>(item);
  let refs = getRefsToResolve(item);
  if (!refs.length) return item;

  const fetchedRefs = await getItems<ItemWithKey>(refs).then((items) =>
    items.reduce(
      (acc, item) => ({ ...acc, [itemToStringKey(item)]: item }),
      {} as Record<string, ItemWithKey>
    )
  );

  return injectRefs(resolvedItem, fetchedRefs);
};

export const getDependencies = async (item: ItemWithKey) =>
  queryAllItems<ReferenceMetadata>(
    "#PK = :PK",
    {
      PK: "dynamodb:reference",
      references: {
        PK: item.PK,
        ...(item.SK && { SK: item.SK }),
      },
    },
    { FilterExpression: "#references = :references" }
  );

export const getResolvedDependencies = async <
  T extends ItemWithKey = ItemWithKey
>(
  item: ItemWithKey
) =>
  getDependencies(item).then((refs) =>
    getItems(
      refs
        .map(({ item }) => item)
        .filter(
          (item, index, array) =>
            array.findIndex((i) => i.SK === item.SK) === index
        )
    ).then((items) => items.filter(Boolean) as T[])
  );
