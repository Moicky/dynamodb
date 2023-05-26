const { getItem, getItems, getAllItems } = require("../../dist");
const { generateItem, PK } = require("../helpers");

describe("get operations", () => {
  it("should get one item", async () => {
    const item = await getItem({ PK, SK: "Book/1" });
    const generatedItem = generateItem("1");

    expect(item).toHaveProperty("PK", generatedItem.PK);
    expect(item).toHaveProperty("SK", generatedItem.SK);
    expect(item).toHaveProperty("title", generatedItem.title);
  });

  it("should get specific items", async () => {
    const keys = Array.from({ length: 5 }).map((_, i) =>
      generateItem((i + 2).toString())
    );

    const items = await getItems(keys);

    expect(items).toHaveLength(5);
    expect(items[0].PK).toEqual(PK);
  });

  it("should also retrieve not existing items", async () => {
    const keys = Array.from({ length: 15 }).map((_, i) =>
      generateItem(i.toString())
    );

    const items = await getItems(keys);

    expect(items).toHaveLength(15);
    expect(items[0].PK).toEqual(PK);
    expect(items).toContain(undefined);
  });

  it("should get all items", async () => {
    const items = await getAllItems();

    expect(items).toHaveLength(10);
    expect(items[0].PK).toEqual(PK);
  });
});
