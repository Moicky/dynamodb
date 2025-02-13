require("dotenv/config");

const { putItems, updateItem, getItem } = require("../../dist");
const { generateItem: unwrappedGenerateItem } = require("../helpers");

const PK = "Operations/Update";
const itemCount = 10;
const generateItem = (id) => unwrappedGenerateItem(PK, id);

describe("update operations", () => {
  beforeAll(async () => {
    const items = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 1).toString())
    );

    await putItems(items);
  });

  it("should update an item", async () => {
    const item = await getItem(generateItem("1"));
    expect(item.PK).toEqual(PK);

    await updateItem(item, { title: "New Title" });
    await new Promise((r) => setTimeout(r, 1000));

    const newItem = await getItem(generateItem("1"));
    expect(newItem.title).toEqual("New Title");
  });

  it("should update an item with a condition", async () => {
    const item = await getItem(generateItem("2"));
    expect(item.PK).toEqual(PK);

    await updateItem(
      item,
      { released: 2000, maxReleased: 1950 },
      { ConditionExpression: "#released < :maxReleased" }
    );

    const newItem = await getItem(item);
    expect(newItem.released).toEqual(2000);

    const res = await updateItem(
      item,
      { released: 210, maxReleased: 1950 },
      { ConditionExpression: "#released < :maxReleased" }
    )
      .then(() => true)
      .catch((e) => {
        expect(e.name).toEqual("ConditionalCheckFailedException");
        return false;
      });
    expect(res).toEqual(false);
  });

  it("should update an return the new item", async () => {
    const item = await getItem(generateItem("3"));
    expect(item.PK).toEqual(PK);

    const newItem = await updateItem(
      item,
      { released: 2000 },
      { ReturnValues: "ALL_NEW" }
    );

    expect(newItem.released).toEqual(2000);
  });

  it("should set updatedAtISO attribute correctly", async () => {
    const item = await getItem(generateItem("4"));
    expect(item.PK).toEqual(PK);

    await updateItem(item, { title: "Another New Title" });

    const updatedItem = await getItem(generateItem("4"));
    expect(updatedItem.updatedAtISO).toBe(new Date(updatedItem.updatedAt).toISOString());
  });
});
