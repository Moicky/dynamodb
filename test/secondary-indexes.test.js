require("dotenv/config");

const { query, queryItems, queryAllItems, putItems } = require("../dist");

const itemCount = 250;
const PK = "SecondaryIndexes";

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

const TableName = process.env.GSI_TABLE;

describe("Secondary indexes workflows", () => {
  beforeAll(async () => {
    await putItems(items, { TableName });
  });

  it("should work with simple queries", async () => {
    const queryResult = await query(
      `#PK = :PK and #stars > :stars`,
      { PK, stars: 4 },
      { TableName, IndexName: "booksByStars", Limit: 10 }
    );

    expect(queryResult.Items.length).toEqual(10);
    expect(queryResult.Items[0].stars.N).toEqual("5");
  });

  it("should query items without retries", async () => {
    const items = await queryItems(
      `#author = :author and begins_with(#SK, :SK)`,
      { author: generateItem("1").author, SK: "Book/" },
      { TableName, IndexName: "booksByAuthor", Limit: 10 }
    );

    expect(items.length).toEqual(10);
    expect(items[0].title).toEqual(generateItem("1").title);
  });

  it("should query items with retries", async () => {
    const items = await queryAllItems(
      `#PK = :PK and #stars > :stars`,
      { PK, stars: 4 },
      { TableName, IndexName: "booksByStars" }
    );

    expect(items.length).toEqual(itemCount);
    expect(items[0].title).toEqual(generateItem(0).title);
  });
});
