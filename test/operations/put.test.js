require("dotenv/config");

const {
  putItem,
  putItems,
  itemExists,
  getItem,
  getItems,
} = require("../../dist");
const { generateItem: unwrappedGenerateItem } = require("../helpers");

const PK = "Operations/Put";
const itemCount = 10;
const generateItem = (id) => unwrappedGenerateItem(PK, id);

describe("put operations", () => {
  beforeAll(async () => {
    const items = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 1).toString())
    );

    await putItems(items);
  });

  it("should insert a new item", async () => {
    const newItem = generateItem("999");

    const doesExist = await itemExists(newItem);
    expect(doesExist).toEqual(false);
    await putItem(newItem);

    const doesExistNow = await itemExists(newItem);
    expect(doesExistNow).toEqual(true);

    const savedItem = await getItem(newItem);
    expect(savedItem.SK).toEqual(newItem.SK);
  });

  it("should insert multiple items", async () => {
    const items = [
      generateItem("998"),
      generateItem("997"),
      generateItem("996"),
    ];

    await putItems(items);

    const savedItems = await getItems(items);
    expect(savedItems.length).toEqual(3);
    expect(savedItems.filter((item) => item).length).toEqual(3);
  });

  it("should insert many items", async () => {
    const items = Array.from({ length: 500 }).map((_, i) =>
      generateItem(i.toString())
    );

    await putItems(items);

    const savedItems = await getItems(items);
    expect(savedItems.length).toEqual(500);
    expect(savedItems.filter((item) => item).length).toEqual(500);
  });

  it("should set createdAtISO attribute correctly", async () => {
    const newItem = generateItem("1000");

    await putItem(newItem);

    const savedItem = await getItem(newItem);
    expect(savedItem.createdAtISO).toBe(new Date(savedItem.createdAt).toISOString());
  });
});
