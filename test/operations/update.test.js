const { updateItem, getItem } = require("../../dist");
const { generateItem, PK } = require("../helpers");

describe("update operations", () => {
  it("should update an item", async () => {
    const item = await getItem(generateItem("1"));
    expect(item.PK).toEqual(PK);

    await updateItem(item, { title: "New Title" });

    const newItem = await getItem(generateItem("1"));
    expect(newItem.title).toEqual("New Title");
  });
});
