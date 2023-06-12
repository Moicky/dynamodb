require("dotenv/config");

const {
  getTableSchema,
  putItem,
  putItems,
  getItem,
  getItems,
  getAllItems,
  itemExists,
  query,
  queryItems,
  queryAllItems,
  updateItem,
  removeAttributes,
  getAscendingId,
  deleteItem,
  deleteItems,
} = require("../dist");

const itemCount = 100;
const keySchemaHash = "bookId";
const generateItem = (id) => ({
  [keySchemaHash]: `Book/${id}`,
  title: "The Great Gatsby",
  author: "F. Scott Fitzgerald",
  released: 1925,
  genre: "Novel",
  pages: 218,
  stars: 5,
});

const items = Array.from({ length: itemCount }).map((_, i) =>
  generateItem((i + 1).toString())
);

const TableName = process.env.SECOND_TABLE;

describe("Second schema workflows", () => {
  it("should have a schema setup", async () => {
    const schema = getTableSchema(TableName);
    expect(schema).toBeDefined();
    expect(schema.hash).toEqual(keySchemaHash);
  });

  it("should insert a new item", async () => {
    const newItem = items[0];
    const doesExist = await itemExists(newItem, { TableName });
    expect(doesExist).toEqual(false);
    await putItem(newItem, { TableName });

    const doesExistNow = await itemExists(newItem, { TableName });
    expect(doesExistNow).toEqual(true);

    const savedItem = await getItem(newItem, { TableName });
    expect(savedItem.SK).toEqual(newItem.SK);
  });

  it("should insert multiple items", async () => {
    const itemsToInsert = items.slice(1);

    const doesExist = await itemExists(itemsToInsert[0], { TableName });
    expect(doesExist).toEqual(false);

    await putItems(itemsToInsert, { TableName });

    const doesExistNow = await itemExists(itemsToInsert[0], { TableName });
    expect(doesExistNow).toEqual(true);

    const doesExistNow2 = await itemExists(
      itemsToInsert[itemsToInsert.length - 1],
      { TableName }
    );
    expect(doesExistNow2).toEqual(true);
  });

  it("should get multiple items", async () => {
    const realItems = items.slice(3, 150);
    const itemsToGet = [{ [keySchemaHash]: "doesntExist" }, ...realItems];

    const retrievedItems = await getItems(itemsToGet, { TableName });
    expect(retrievedItems.length).toEqual(itemsToGet.length);
    expect(retrievedItems.filter((i) => i).length).toEqual(realItems.length);

    Object.keys(realItems[10]).forEach((key) => {
      expect(retrievedItems[11][key]).toEqual(realItems[10][key]);
    });

    expect(retrievedItems[0]).toEqual(undefined);
  });

  it("should get all items", async () => {
    const retrievedItems = await getAllItems({ TableName });
    expect(retrievedItems.length).toEqual(itemCount);
  });

  it("should work with simple queries", async () => {
    const queryResult = await query(
      `#${keySchemaHash} = :${keySchemaHash}`,
      { [keySchemaHash]: "Book/1" },
      { TableName }
    );

    expect(queryResult.Items.length).toEqual(1);
  });

  it("should query items without retries", async () => {
    const items = await queryItems(
      `#${keySchemaHash} = :${keySchemaHash}`,
      { [keySchemaHash]: "Book/1" },
      { TableName }
    );

    expect(items.length).toEqual(1);
    expect(items[0][keySchemaHash]).toEqual("Book/1");
  });

  it("should query items with retries", async () => {
    const items = await queryAllItems(
      `#${keySchemaHash} = :${keySchemaHash}`,
      { [keySchemaHash]: "Book/1" },
      { TableName }
    );

    expect(items.length).toEqual(1);
    expect(items[0][keySchemaHash]).toEqual("Book/1");
  });

  it("should update items", async () => {
    const itemToUpdate = items[50];
    const oldItem = await getItem(itemToUpdate, { TableName });

    expect(oldItem.stars).toEqual(5);

    const newItem = await updateItem(
      itemToUpdate,
      { stars: 1 },
      { TableName, ReturnValues: "ALL_NEW" }
    );

    expect(newItem.stars).toEqual(1);

    const updatedItem = await getItem(itemToUpdate, { TableName });
    expect(updatedItem.stars).toEqual(1);
  });

  it("should remove attributes", async () => {
    const itemToUpdate = items[40];
    const oldItem = await getItem(itemToUpdate, { TableName });

    expect(oldItem.stars).toEqual(5);

    await removeAttributes(itemToUpdate, ["stars"], { TableName });

    const updatedItem = await getItem(itemToUpdate, { TableName });
    expect(updatedItem.stars).toEqual(undefined);
  });

  it("should get ascending id", async () => {
    const id = await getAscendingId({ TableName, bookId: "Books" });
    expect(id).toEqual("00000001");
  });

  it("should delete a single item", async () => {
    const itemToDelete = items[10];
    const doesExist = await itemExists(itemToDelete, { TableName });
    expect(doesExist).toEqual(true);

    await deleteItem(itemToDelete, { TableName });

    const doesExistNow = await itemExists(itemToDelete, { TableName });
    expect(doesExistNow).toEqual(false);
  });

  it("should delete multiple items", async () => {
    const itemsToDelete = items.filter((_, i) => i !== 10);
    const doesExist = await itemExists(itemsToDelete[0], { TableName });
    expect(doesExist).toEqual(true);

    await deleteItems(itemsToDelete, { TableName });

    const doesExistNow = await itemExists(itemsToDelete[0], { TableName });
    expect(doesExistNow).toEqual(false);

    const allExist = await getItems(itemsToDelete, { TableName });
    expect(allExist.length).toEqual(itemsToDelete.length);
    expect(allExist.filter((item) => item).length).toEqual(0);
  });
});
