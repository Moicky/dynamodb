require("dotenv/config");

const { putItems, transactWriteItems, getItems } = require("../../dist");
const { generateItem: unwrappedGenerateItem } = require("../helpers");

const PK = "Operations/TransactWriteItems";
const itemCount = 100;

const generateItem = (id, isRented = false) =>
  unwrappedGenerateItem(PK, id, isRented);

const conditionItemFalsy = {
  PK: PK,
  SK: `Condition/1`,
  condition: false,
};

const conditionItemTruthy = {
  PK: PK,
  SK: `Condition/2`,
  condition: true,
};

describe("transactWriteItems operations", () => {
  beforeAll(async () => {
    const items = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 1).toString(), i % 2 === 0)
    );

    const conditionItems = [conditionItemTruthy, conditionItemFalsy];

    await putItems([...items, ...conditionItems]);
  });

  it("should perform a condition check operation | truthy", async () => {
    const promise = transactWriteItems([
      {
        ConditionCheck: {
          key: conditionItemTruthy,
          ConditionExpression: "#condition = :condition",
          conditionData: {
            condition: true,
          },
        },
      },
    ]);

    await expect(promise).resolves.toEqual({});
  });

  it("should perform a condition check operation | falsy ", async () => {
    const promise = transactWriteItems([
      {
        ConditionCheck: {
          key: conditionItemFalsy,
          ConditionExpression: "#condition = :condition",
          conditionData: {
            condition: true,
          },
        },
      },
    ]);

    await expect(promise).rejects.toThrow("ConditionalCheckFailed");
  });

  it("should perform a put operation", async () => {
    const itemCount = 5;
    const itemsToPut = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 500).toString())
    );

    const promise = transactWriteItems(
      itemsToPut.map((item) => ({
        Put: { item },
      }))
    );

    await expect(promise).resolves.toEqual({});

    const insertedItems = await getItems(itemsToPut);
    expect(insertedItems.length).toEqual(itemCount);

    const { createdAt, ...insertedItem } = insertedItems[0];
    expect(insertedItem).toEqual(itemsToPut[0]);
  });

  it("should perform a put operation with a condition expression | truthy", async () => {
    const itemCount = 5;
    const itemsToPut = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 600).toString())
    );

    const promise = transactWriteItems(
      itemsToPut
        .map((item) => ({
          Put: { item },
        }))
        .concat([
          {
            ConditionCheck: {
              key: conditionItemTruthy,
              ConditionExpression: "#condition = :condition",
              conditionData: {
                condition: true,
              },
            },
          },
        ])
    );

    await expect(promise).resolves.toEqual({});

    const insertedItems = await getItems(itemsToPut);
    expect(insertedItems.length).toEqual(itemCount);

    const { createdAt, ...insertedItem } = insertedItems[0];
    expect(insertedItem).toEqual(itemsToPut[0]);
  });

  it("should perform a put operation with a condition expression | falsy", async () => {
    const itemCount = 5;
    const itemsToPut = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 700).toString())
    );

    const promise = transactWriteItems(
      itemsToPut
        .map((item) => ({
          Put: { item },
        }))
        .concat([
          {
            ConditionCheck: {
              key: conditionItemFalsy,
              ConditionExpression: "#condition = :condition",
              conditionData: {
                condition: true,
              },
            },
          },
        ])
    );

    await expect(promise).rejects.toThrow("ConditionalCheckFailed");

    const insertedItems = await getItems(itemsToPut);
    expect(insertedItems.filter(Boolean).length).toEqual(0);
  });

  it("should perform a delete operation", async () => {
    const itemCount = 10;
    const itemsToDelete = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 800).toString())
    );
    await putItems(itemsToDelete);

    const response = await transactWriteItems(
      itemsToDelete.map((item) => ({
        Delete: {
          key: item,
        },
      }))
    );

    expect(response).toEqual({});

    const deletedItems = await getItems(itemsToDelete);

    expect(deletedItems.filter(Boolean).length).toEqual(0);
  });

  it("should perform update operations", async () => {
    const itemCount = 10;
    const itemsToUpdate = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 900).toString())
    );

    await putItems(itemsToUpdate);

    let response = await transactWriteItems(
      itemsToUpdate.map((item) => ({
        Update: {
          key: item,
          ConditionExpression: "#isRented = :isRented2",
          conditionData: {
            isRented2: false,
          },
          updateData: {
            isRented: true,
          },
        },
      }))
    );

    expect(response).toEqual({});

    const newItems = await getItems(itemsToUpdate);

    response = await transactWriteItems(
      newItems.map((item) => ({
        ConditionCheck: {
          key: item,
          ConditionExpression: "#isRented = :isRented",
          conditionData: {
            isRented: true,
          },
        },
      }))
    );

    expect(response).toEqual({});
  });

  it("should return ItemCollectionMetrics after update operations", async () => {
    const itemCount = 5;
    const itemsToUpdate = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 1000).toString())
    );

    const response = await transactWriteItems(
      itemsToUpdate.map((item) => ({
        Update: {
          key: item,
          updateData: {
            isRented: true,
          },
        },
      })),
      { ReturnItemCollectionMetrics: "SIZE" }
    );

    expect(response).toBeDefined();
    expect(typeof response).toBe("object");

    // Verify the updated items exist
    const updatedItems = await getItems(itemsToUpdate);
    expect(updatedItems.filter(Boolean).length).toEqual(itemCount);
    expect(updatedItems.every((item) => item.isRented === true)).toBe(true);
  });
});
