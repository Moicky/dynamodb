require("dotenv/config");
const { putItems, itemExists, getAscendingId } = require("../../dist");
const { generateItem: unwrappedGenerateItem } = require("../helpers");

const PK = "Operations/Misc";
const itemCount = 10;
const generateItem = (id) => unwrappedGenerateItem(PK, id);

describe("misc operations", () => {
  beforeAll(async () => {
    const items = Array.from({ length: itemCount }).map((_, i) =>
      generateItem((i + 1).toString())
    );

    await putItems(items);
  });

  it("should check if item exists", async () => {
    const existingItem = generateItem("1");
    const nonExistingItem = generateItem("999");

    expect(await itemExists(existingItem)).toEqual(true);
    expect(await itemExists(nonExistingItem)).toEqual(false);
  });

  it("should generate new id", async () => {
    const id1 = await getAscendingId({ PK, SK: "Book" });
    const id2 = await getAscendingId({ PK, SK: "Book/" });
    const id3 = await getAscendingId({ PK, SK: "Book", length: 3 });

    expect(typeof id1).toEqual("string");
    expect(id1).toEqual("00000010");
    expect(id2).toEqual("00000010");
    expect(id3).toEqual("010");
    expect(getAscendingId({ SK: "Book" })).rejects.toThrow();
  });
});
