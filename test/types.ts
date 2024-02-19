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
  updateItem,
} from "../dist";

type DemoItem = {
  PK: string;
  SK: string;
  stars: number;
};

const item = {
  PK: "User/1",
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
  const update1 = (await updateItem(bigItem, { big: "5" })) satisfies undefined;
  const update2 = (await updateItem<DemoItem>(item, {
    stars: 5,
  })) satisfies undefined;
  const update3 = (await updateItem(
    demoItem,
    { stars: 5 },
    { ReturnValues: "ALL_NEW" }
  )) satisfies DemoItem;
  const update4 = await updateItem<DemoItem>(
    item,
    { stars: 5 },
    { ReturnValues: "ALL_NEW" }
  );

  const removeAttributes1 = await removeAttributes(demoItem, ["stars"]);
}
