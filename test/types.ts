import "dotenv/config";

import { PutItemCommandOutput } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBItem,
  getAllItems,
  getItem,
  getItems,
  putItem,
  queryAllItems,
  queryItems,
  queryPaginatedItems,
  removeAttributes,
  transactGetItems,
  Transaction,
  updateItem,
} from "../src";

type DemoItem = {
  PK: `User/${string}`;
  SK: string;
  stars: number;
};

type DemoItem2 = {
  PK: `Demo/${string}`;
  SK: string;
  name: string;
};

const item = {
  PK: "User/1" as const,
  SK: "Book/1",
  stars: 5,
};
const demoItem = item as DemoItem;

async function playground() {
  const get1 = (await getItem(demoItem)) satisfies DemoItem | undefined;
  const get2 = (await getItem<DemoItem>(item)) satisfies DemoItem | undefined;

  const get3 = (await getItems([demoItem, demoItem])) satisfies Array<
    DemoItem | undefined
  >;
  const get4 = (await getItems<DemoItem>([item, item])) satisfies Array<
    DemoItem | undefined
  >;

  const getAll1 = (await getAllItems()) satisfies Array<DynamoDBItem>;
  const getAll2 = (await getAllItems<DemoItem>()) satisfies Array<DemoItem>;

  const put1 = (await putItem(demoItem)) satisfies PutItemCommandOutput;
  const put2 = (await putItem<DemoItem>(item)) satisfies PutItemCommandOutput;
  const put3 = (await putItem(demoItem, {
    ReturnValues: "ALL_NEW",
  })) satisfies DynamoDBItem;
  const put4 = (await putItem<DemoItem>(item, {
    ReturnValues: "ALL_NEW",
  })) satisfies DemoItem;
  const put5 = (await putItem(demoItem, {
    TableName: "test",
  })) satisfies PutItemCommandOutput;
  const put6 = (await putItem<DemoItem>(item, {
    TableName: "test",
  })) satisfies PutItemCommandOutput;

  const query1 = (await queryItems("#PK = :PK", {
    PK: "User/1",
  })) satisfies Array<DynamoDBItem>;
  const query2 = (await queryItems<DemoItem>("#PK = :PK", {
    PK: "User/1",
  })) satisfies Array<DemoItem>;

  const queryAll1 = (await queryAllItems("#PK = :PK", {
    PK: "User/1",
  })) satisfies Array<DynamoDBItem>;
  const queryAll2 = (await queryAllItems<DemoItem>("#PK = :PK", {
    PK: "User/1",
  })) satisfies Array<DemoItem>;

  const queryPaginated1 = (
    await queryPaginatedItems("#PK = :PK", { PK: "User/1" }, { pageSize: 1 })
  )["items"] satisfies Array<DynamoDBItem>;
  const queryPaginated2 = (
    await queryPaginatedItems<DemoItem>(
      "#PK = :PK",
      { PK: "User/1" },
      { pageSize: 1 }
    )
  )["items"] satisfies Array<DemoItem>;

  const transactGet1 = (await transactGetItems([
    { key: demoItem },
  ])) satisfies Array<DemoItem | undefined>;
  const transactGet2 = (await transactGetItems<DemoItem>([
    { key: demoItem },
  ])) satisfies Array<DemoItem | undefined>;

  const bigItem = {} as DemoItem & { big: string };
  const undefined1 = (await updateItem(bigItem, {
    big: "5",
  })) satisfies undefined;
  const undefined2 = (await updateItem<DemoItem>(item, {
    stars: 5,
  })) satisfies undefined;
  const demoItem1 = (await updateItem(
    demoItem,
    { stars: 5 },
    { ReturnValues: "ALL_NEW" }
  )) satisfies DemoItem;
  const demoItem2 = (await updateItem<DemoItem>(
    item,
    { stars: 5 },
    { ReturnValues: "ALL_NEW" }
  )) satisfies DemoItem;
  const undefined3 = (await updateItem(
    item,
    { stars: 5 },
    { TableName: "test" }
  )) satisfies undefined;
  const undefined4 = (await updateItem<DemoItem>(
    item,
    { stars: 5 },
    { TableName: "test" }
  )) satisfies undefined;

  const removeAttributes1 = await removeAttributes(demoItem, ["stars"]);

  const a: DemoItem = {
    PK: "User/1",
    SK: "Book/1",
    stars: 5,
  };

  const itemsWithTypedArray = await getItems<[DemoItem, DemoItem2]>([
    a,
    { PK: "Demo/1", SK: "Book/1" },
  ]);
  const [typedItem1, typedItem2] = itemsWithTypedArray;

  const inferredItems = await getItems([a, a]);

  const [inferredItem1, inferredItem2] = inferredItems;

  const simpleTypedItems = await getItems<DemoItem>([a, a]);
  const [simpleTypedItem1, simpleTypedItem2] = simpleTypedItems;
}

async function transactionPlayground() {
  type TxnItem = {
    PK: `User/${string}`;
    SK: string;
    stars: number;
    otherProp: string;
    nested: {
      params: number;
    };
  };

  const item: TxnItem = {
    PK: "User/1",
    SK: "Book/1",
    stars: 0,
    otherProp: "test",
    nested: {
      params: 1,
    },
  };

  await putItem(item);

  const txn = new Transaction();
  txn.update<TxnItem>(item).set({ otherProp: "test" });
  txn.update<TxnItem>(item).removeAttributes("nested");
  await txn.execute();

  const updatedItem = await getItem<TxnItem>(item);
  console.log(updatedItem);
}

transactionPlayground();
