const { initFixes, queryAllItems, getFixes, putItems } = require("../dist");

const GSITable = process.env.GSI_TABLE;

const itemCount = 50;
const PK = "Fixes";

const generateItem = (id) => ({
  PK,
  SK: `Book/${id}`,
  title: "The Great Gatsby",
  author: "F. Scott Fitzgerald",
  released: 1925,
  genre: "Novel",
  pages: 218,
  stars: 5,
});

const items = Array.from({ length: itemCount }).map((_, i) =>
  generateItem((i + 1).toString())
);

describe("Fixes workflows", () => {
  beforeAll(async () => {
    await putItems(items, { TableName: GSITable });
  });

  it("should init fixes", () => {
    expect(getFixes().marshallOptions?.removeUndefinedValues).toEqual(true);

    initFixes({
      disableConsistantReadWhenUsingIndexes: {
        enabled: true,
      },
      marshallOptions: {
        removeUndefinedValues: false,
      },
    });

    const newFixes = getFixes();

    expect(newFixes.disableConsistantReadWhenUsingIndexes.enabled).toEqual(
      true
    );
    expect(newFixes.marshallOptions.removeUndefinedValues).toEqual(false);
  });

  it("should crash when querying with ConsistantRead and GSIs", async () => {
    initFixes({});

    await expect(
      queryAllItems(
        `#PK = :PK and #stars > :stars`,
        { PK, stars: 4 },
        { TableName: GSITable, IndexName: "booksByStars", ConsistentRead: true }
      )
    ).rejects.toThrowError();
  });

  it("shouldn't crash when using fixes and using ConsistantRead with GSIs", async () => {
    initFixes({
      disableConsistantReadWhenUsingIndexes: {
        enabled: true,
      },
    });
    const items = await queryAllItems(
      `#PK = :PK and #stars > :stars`,
      { PK, stars: 4 },
      { TableName: GSITable, IndexName: "booksByStars", ConsistentRead: true }
    );

    expect(items.length).toEqual(itemCount);
  });
});
