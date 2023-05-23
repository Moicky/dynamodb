const { itemExists, getNewId } = require("../../dist");
const { generateItem, PK } = require("../helpers");

describe("misc operations", () => {
  it("should check if item exists", async () => {
    const existingItem = generateItem("1");
    const notExistingItem = generateItem("999");

    const existing = await itemExists(existingItem);
    const notExisting = await itemExists(notExistingItem);

    expect(existing).toEqual(true);
    expect(notExisting).toEqual(false);
  });

  it("should generate new id", async () => {
    const id1 = await getNewId({ PK, SK: "Book" });
    const id2 = await getNewId({ PK, SK: "Book/" });
    const id3 = await getNewId({ PK, SK: "Book", length: 3 });

    expect(typeof id1).toEqual("string");
    expect(id1).toEqual("Book/00000010");
    expect(id2).toEqual("Book/00000010");
    expect(id3).toEqual("Book/010");
    expect(getNewId({ SK: "Book" })).rejects.toThrow();
  });
});
