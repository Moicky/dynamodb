require("dotenv/config");
const { getItem, getItems, getAllItems, putItems } = require("../../dist");
const { generateItem: unwrappedGenerateItem } = require("../helpers");

const PK = "Operations/Get";
const itemCount = 10;
const generateItem = (id) => unwrappedGenerateItem(PK, id);

describe("get operations", () => {
  beforeAll(async () => {
    const items = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 1).toString())
    );

    await putItems(items);
  });

  it("should get one item", async () => {
    const item = await getItem({ PK, SK: "Book/1" });
    const generatedItem = generateItem("1");

    expect(item).toHaveProperty("PK", generatedItem.PK);
    expect(item).toHaveProperty("SK", generatedItem.SK);
    expect(item).toHaveProperty("title", generatedItem.title);
  });

  it("should get specific items", async () => {
    const keys = Array.from({ length: 5 }).map((_, i) =>
      generateItem((i + 5).toString())
    );

    const items = await getItems(keys);

    expect(items).toHaveLength(5);
    expect(items[0].PK).toEqual(PK);
  });

  it("should also retrieve not existing items", async () => {
    const keys = Array.from({ length: itemCount + 5 }).map((_, i) =>
      generateItem((i + 1).toString())
    );

    const items = await getItems(keys);

    expect(items).toHaveLength(itemCount + 5);
    expect(items[0].PK).toEqual(PK);
    expect(items).toContain(undefined);
  });

  it("should get all items", async () => {
    const items = await getAllItems();

    expect(items.filter((item) => item?.PK === PK)).toHaveLength(itemCount);
  });
});
