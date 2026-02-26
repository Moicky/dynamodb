require("dotenv/config");

const {
  Transaction,
  getItems,
  putItem,
  putItems,
  getItem,
} = require("../../dist");
const { generateItem: unwrappedGenerateItem } = require("../helpers");

const PK = "Transactions";
const itemCount = 10;
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

describe("Transaction operations", () => {
  beforeAll(async () => {
    const items = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 1).toString(), (i + 1) % 2 === 0)
    );

    const conditionItems = [conditionItemTruthy, conditionItemFalsy];

    await putItems([...items, ...conditionItems]);
  });

  describe("create operations", () => {
    it("should create a single item", async () => {
      const item = generateItem("1000");

      const transaction = new Transaction();
      transaction.create(item);

      await transaction.execute();

      const savedItem = await getItem(item);
      expect(savedItem).toBeDefined();
      expect(savedItem.PK).toEqual(item.PK);
      expect(savedItem.SK).toEqual(item.SK);
      expect(savedItem.title).toEqual(item.title);
      expect(savedItem.createdAt).toBeDefined();
      expect(savedItem.updatedAt).toBeUndefined();
    });

    it("should create multiple items in a single transaction", async () => {
      const items = [
        generateItem("1001"),
        generateItem("1002"),
        generateItem("1003"),
      ];

      const transaction = new Transaction();
      items.forEach((item) => transaction.create(item));

      await transaction.execute();

      const savedItems = await getItems(items);
      expect(savedItems.length).toEqual(3);
      expect(savedItems.filter(Boolean).length).toEqual(3);
      savedItems.forEach((item, index) => {
        expect(item.PK).toEqual(items[index].PK);
        expect(item.SK).toEqual(items[index].SK);
        expect(item.createdAt).toBeDefined();
      });
    });

    it("should create items with custom table name", async () => {
      const item = generateItem("1004");

      const transaction = new Transaction({
        tableName: process.env.DEFAULT_TABLE,
      });
      transaction.create(item, { TableName: process.env.DEFAULT_TABLE });

      await transaction.execute();

      const savedItem = await getItem(item);
      expect(savedItem).toBeDefined();
    });
  });

  describe("update operations", () => {
    it("should update an item with set operation", async () => {
      const item = generateItem("2000");
      await putItems([item]);

      const transaction = new Transaction();
      transaction.update(item).set({ title: "Updated Title", released: 2024 });

      await transaction.execute();

      const updatedItem = await getItem(item);
      expect(updatedItem.title).toEqual("Updated Title");
      expect(updatedItem.released).toEqual(2024);
      expect(updatedItem.updatedAt).toBeDefined();
    });

    it("should update an item with multiple set operations", async () => {
      const item = generateItem("2001");
      await putItems([item]);

      const transaction = new Transaction();
      transaction
        .update(item)
        .set({ title: "First Update" })
        .set({ author: "New Author" })
        .set({ released: 2025 });

      await transaction.execute();

      const updatedItem = await getItem(item);
      expect(updatedItem.title).toEqual("First Update");
      expect(updatedItem.author).toEqual("New Author");
      expect(updatedItem.released).toEqual(2025);
    });

    it("should update an item with adjustNumber operation", async () => {
      const item = generateItem("2002");
      await putItems([item]);
      const originalStars = item.stars || 0;

      const transaction = new Transaction();
      transaction.update(item).adjustNumber({ stars: 2 });

      await transaction.execute();

      const updatedItem = await getItem(item);
      expect(updatedItem.stars).toEqual(originalStars + 2);
    });

    it("should update an item with removeAttributes operation", async () => {
      const item = generateItem("2003");
      await putItems([item]);
      expect(item.genre).toBeDefined();

      const transaction = new Transaction();
      transaction.update(item).removeAttributes("genre", "pages");

      await transaction.execute();

      const updatedItem = await getItem(item);
      expect(updatedItem.genre).toBeUndefined();
      expect(updatedItem.pages).toBeUndefined();
    });

    it("should update an item with addItemsToSet operation", async () => {
      const item = generateItem("2004");
      item.tags = new Set(["fiction", "classic"]);

      await putItems([item]);

      const transaction = new Transaction();
      transaction
        .update(item)
        .addItemsToSet({ tags: new Set(["drama", "literature"]) });

      await transaction.execute();

      const updatedItem = await getItem(item);
      expect(updatedItem.tags).toBeInstanceOf(Set);
      expect(updatedItem.tags.has("fiction")).toBe(true);
      expect(updatedItem.tags.has("drama")).toBe(true);
      expect(updatedItem.tags.has("literature")).toBe(true);
    });

    it("should update an item with deleteItemsFromSet operation", async () => {
      const item = generateItem("2005");
      item.tags = new Set(["fiction", "classic", "drama"]);

      await putItems([item]);

      const transaction = new Transaction();
      transaction
        .update(item)
        .deleteItemsFromSet({ tags: new Set(["classic"]) });

      await transaction.execute();

      const updatedItem = await getItem(item);
      expect(updatedItem.tags).toBeInstanceOf(Set);
      expect(updatedItem.tags.has("fiction")).toBe(true);
      expect(updatedItem.tags.has("classic")).toBe(false);
      expect(updatedItem.tags.has("drama")).toBe(true);
    });

    it("should update an item with condition expression", async () => {
      const item = generateItem("2006", false);
      await putItems([item]);
      expect(item.isRented).toBe(false);

      const transaction = new Transaction();
      transaction
        .update(item)
        .set({ isRented: true })
        .onCondition({
          expression: "#isRented = :isRented",
          values: { isRented: false },
        });

      await transaction.execute();

      const updatedItem = await getItem(item);
      expect(updatedItem.isRented).toBe(true);
    });

    it("should fail update with condition expression when condition is false", async () => {
      const item = generateItem("2007", true);
      await putItems([item]);
      expect(item.isRented).toBe(true);

      const transaction = new Transaction();
      transaction
        .update(item)
        .set({ isRented: false })
        .onCondition({
          expression: "#isRented = :isRented",
          values: { isRented: false },
        });

      await expect(transaction.execute()).rejects.toThrow(
        "ConditionalCheckFailed"
      );
    });

    it("should update multiple items in a single transaction", async () => {
      const items = [
        generateItem("2008"),
        generateItem("2009"),
        generateItem("2010"),
      ];
      await putItems(items);

      const transaction = new Transaction();
      items.forEach((item) =>
        transaction.update(item).set({ title: "Batch Updated" })
      );

      await transaction.execute();

      const updatedItems = await getItems(items);
      updatedItems.forEach((item) => {
        expect(item.title).toEqual("Batch Updated");
      });
    });
  });

  describe("delete operations", () => {
    it("should delete a single item", async () => {
      const item = generateItem("3000");
      await putItems([item]);

      const transaction = new Transaction();
      transaction.delete(item);

      await transaction.execute();

      const deletedItem = await getItem(item);
      expect(deletedItem).toBeUndefined();
    });

    it("should delete multiple items in a single transaction", async () => {
      const items = [
        generateItem("3001"),
        generateItem("3002"),
        generateItem("3003"),
      ];
      await putItems(items);

      const transaction = new Transaction();
      items.forEach((item) => transaction.delete(item));

      await transaction.execute();

      const deletedItems = await getItems(items);
      expect(deletedItems.filter(Boolean).length).toEqual(0);
    });
  });

  describe("condition check operations", () => {
    it("should pass condition check when condition is true", async () => {
      const transaction = new Transaction();
      transaction.addConditionFor(conditionItemTruthy).matches({
        expression: "#condition = :condition",
        values: { condition: true },
      });

      await expect(transaction.execute()).resolves.toEqual({});
    });

    it("should fail condition check when condition is false", async () => {
      const transaction = new Transaction();
      transaction.addConditionFor(conditionItemFalsy).matches({
        expression: "#condition = :condition",
        values: { condition: true },
      });

      await expect(transaction.execute()).rejects.toThrow(
        "ConditionalCheckFailed"
      );
    });

    it("should combine condition check with create operation", async () => {
      const item = generateItem("4000");

      const transaction = new Transaction();
      transaction.create(item);
      transaction.addConditionFor(conditionItemTruthy).matches({
        expression: "#condition = :condition",
        values: { condition: true },
      });

      await transaction.execute();

      const savedItem = await getItem(item);
      expect(savedItem).toBeDefined();
    });

    it("should combine condition check with update operation", async () => {
      const item = generateItem("4001");
      await putItems([item]);

      const transaction = new Transaction();
      transaction.update(item).set({ title: "Conditional Update" });
      transaction.addConditionFor(conditionItemTruthy).matches({
        expression: "#condition = :condition",
        values: { condition: true },
      });

      await transaction.execute();

      const updatedItem = await getItem(item);
      expect(updatedItem.title).toEqual("Conditional Update");
    });
  });

  describe("mixed operations", () => {
    it("should perform create, update, and delete in a single transaction", async () => {
      const createItem = generateItem("5000");
      const updateItem = generateItem("5001");
      const deleteItem = generateItem("5002");
      await putItems([updateItem, deleteItem]);

      const transaction = new Transaction();
      transaction.create(createItem);
      transaction.update(updateItem).set({ title: "Mixed Update" });
      transaction.delete(deleteItem);

      await transaction.execute();

      const created = await getItem(createItem);
      expect(created).toBeDefined();

      const updated = await getItem(updateItem);
      expect(updated.title).toEqual("Mixed Update");

      const deleted = await getItem(deleteItem);
      expect(deleted).toBeUndefined();
    });

    it("should perform multiple operations with condition checks", async () => {
      const createItem1 = generateItem("6000");
      const createItem2 = generateItem("6001");
      const updateItem = generateItem("6002");
      await putItems([updateItem]);

      const transaction = new Transaction();
      transaction.create(createItem1);
      transaction.create(createItem2);
      transaction.update(updateItem).set({ title: "Conditional Batch" });
      transaction.addConditionFor(conditionItemTruthy).matches({
        expression: "#condition = :condition",
        values: { condition: true },
      });

      await transaction.execute();

      const created1 = await getItem(createItem1);
      const created2 = await getItem(createItem2);
      const updated = await getItem(updateItem);

      expect(created1).toBeDefined();
      expect(created2).toBeDefined();
      expect(updated.title).toEqual("Conditional Batch");
    });
  });

  describe("error cases", () => {
    it("should throw error when executing empty transaction", async () => {
      const transaction = new Transaction();

      await expect(transaction.execute()).rejects.toThrow(
        "[@moicky/dynamodb]: Invalid number of operations"
      );
    });

    it("should throw error when transaction has more than 100 operations without split config", async () => {
      const transaction = new Transaction();
      const items = Array.from({ length: 101 }).map((_, i) =>
        generateItem(`7000-${i}`)
      );

      items.forEach((item) => transaction.create(item));

      await expect(transaction.execute()).rejects.toThrow(
        "[@moicky/dynamodb]: Invalid number of operations"
      );
    });
  });

  describe("custom timestamps", () => {
    it("should use custom createdAt and updatedAt timestamps", async () => {
      const customCreatedAt = "2024-01-01T00:00:00Z";
      const customUpdatedAt = "2024-01-02T00:00:00Z";

      const item = generateItem("8000");

      const transaction = new Transaction({
        createdAt: customCreatedAt,
        updatedAt: customUpdatedAt,
      });
      transaction.create(item);

      await transaction.execute();

      const savedItem = await getItem(item);
      expect(savedItem.createdAt).toEqual(customCreatedAt);
      expect(savedItem.updatedAt).toBeUndefined();
    });

    it("should use custom updatedAt for update operations", async () => {
      const customUpdatedAt = "2024-12-31T23:59:59Z";
      const item = generateItem("8001");
      await putItems([item]);

      const transaction = new Transaction({
        updatedAt: customUpdatedAt,
      });
      transaction.update(item).set({ title: "Custom Timestamp" });

      await transaction.execute();

      const updatedItem = await getItem(item);
      expect(updatedItem.updatedAt).toEqual(customUpdatedAt);
    });
  });

  describe("add operations", () => {
    it("should adjust number by a given value", async () => {
      const item = generateItem("9000");
      await putItem(item);

      const transaction = new Transaction();
      transaction.update(item).adjustNumber({
        stars: 2,
      });

      await transaction.execute();

      const newItem = await getItem(item);
      expect(newItem.stars).toEqual(item.stars + 2);
    });

    it("should adjust an unknown attribute by a given value", async () => {
      const item = generateItem("9001");
      await putItem(item);

      const transaction = new Transaction();
      transaction.update(item).adjustNumber({
        temp: 2,
      });

      await transaction.execute();

      const newItem = await getItem(item);
      expect(newItem.temp).toEqual(2);
      expect(newItem.stars).toEqual(item.stars);
    });
  });

  it("should adjust a number in a nested object", async () => {
    const item = generateItem("9002");
    const prevItem = {
      ...item,
      nested: {
        number: 1,
      },
    };
    await putItem(prevItem);

    const transaction = new Transaction();
    transaction
      .update(item)
      .adjustNumber({
        "nested.number": 2,
      })
      .onCondition({
        expression: "#nested.#number < :number",
        values: {
          number: 10,
        },
      });

    await transaction.execute().catch((e) => {
      console.log(e);
      console.log(e.CancellationReasons);
      if (e?.CancellationReasons?.[0]?.Code === "ConditionalCheckFailed") {
        console.log("hi");
      }
    });

    const newItem = await getItem(item, { ConsistentRead: true });
    expect(newItem.nested.number).toEqual(3);
  });

  it("should merge update operations for the same item", async () => {
    const item = generateItem("9003");
    await putItem(item);

    const transaction = new Transaction();
    transaction.update(item).set({ title: "Test" });
    transaction
      .update(item)
      .set({ author: "Test Author" })
      .adjustNumber({ stars: 1 });

    await transaction.execute();

    const newItem = await getItem(item, { ConsistentRead: true });
    expect(newItem.title).toEqual("Test");
    expect(newItem.author).toEqual("Test Author");
    expect(newItem.stars).toEqual(item.stars + 1);
  });
});
