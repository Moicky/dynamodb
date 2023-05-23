const {
  deleteItem,
  deleteItems,
  getItem,
  getAllItems,
} = require("../../dist/built/commonjs");
const { generateItem, PK } = require("../helpers");

describe("delete operations", () => {
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
    expect(allItems.length).toEqual(9);

    await deleteItems(items);

    const newAllItems = await getAllItems();
    expect(newAllItems.length).toEqual(6);
  });

  it("should not fail if item does not exist", async () => {
    const item = generateItem("1");

    await deleteItem(item);
    await deleteItem(item);
  });
});
