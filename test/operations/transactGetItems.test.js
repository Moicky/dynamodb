require("dotenv/config");

const { putItems, transactGetItems } = require("../../dist");
const { generateItem: unwrappedGenerateItem } = require("../helpers");

const PK = "Operations/TransactGetItems";
const itemCount = 100;
const generateItem = (id) => unwrappedGenerateItem(PK, id);

describe("transactGetItems operations", () => {
  beforeAll(async () => {
    const items = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 1).toString())
    );

    await putItems(items);
  });

  it("should get items from the default table", async () => {
    const itemsToGet = Array.from({ length: 5 }).map((_, i) =>
      generateItem((i + 10).toString())
    );

    const items = await transactGetItems(
      itemsToGet.map((item) => ({ key: item }))
    );

    expect(items).toHaveLength(5);
    expect(items[0].PK).toBe(PK);

    const { createdAt, ...retrievedItem } = items[3];
    expect(createdAt).toBeGreaterThan(0);
    expect(retrievedItem).toEqual(itemsToGet[3]);
  });

  it("should get items from custom tables", async () => {
    const itemsToGet = Array.from({ length: 5 }).map((_, i) =>
      generateItem((i + 10).toString())
    );

    const items = await transactGetItems(
      itemsToGet.map((item, i) => ({
        key: item,
        ...(i === 1 && { TableName: process.env.GSI_TABLE }),
      }))
    );

    expect(items).toHaveLength(5);
    expect(items[0].PK).toBe(PK);

    const { createdAt, ...retrievedItem } = items[3];
    expect(createdAt).toBeGreaterThan(0);
    expect(retrievedItem).toEqual(itemsToGet[3]);

    expect(items[1]).toBeUndefined();
  });
});
