require("dotenv/config");

const {
  putItems,
  deleteItem,
  deleteItems,
  getItem,
  getAllItems,
} = require("../../dist");
const { generateItem: unwrappedGenerateItem } = require("../helpers");

const PK = "Operations/Delete";
const itemCount = 10;
const generateItem = (id) => unwrappedGenerateItem(PK, id);

describe("delete operations", () => {
  beforeAll(async () => {
    const items = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 1).toString())
    );

    await putItems(items);
  });

  it("should delete one item", async () => {
    const item = generateItem("1");

    const oldItem = await getItem(item);
    expect(oldItem.PK).toEqual(PK);
    await deleteItem(oldItem);

    const newItem = await getItem(item);
    expect(newItem).toBeUndefined();
  });

  it("should delete multiple items", async () => {
    const items = [generateItem("2"), generateItem("5"), generateItem("8")];

    const allItems = await getAllItems();
    expect(allItems.filter((item) => item.PK === PK).length).toEqual(
      itemCount - 1
    );

    await deleteItems(items);

    const newAllItems = await getAllItems();
    expect(newAllItems.filter((item) => item.PK === PK).length).toEqual(
      itemCount - items.length - 1
    );
  });

  it("should not fail if item does not exist", async () => {
    const item = generateItem("1");

    await deleteItem(item);
    await deleteItem(item);
  });
});
