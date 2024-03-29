require("dotenv/config");

const {
  query,
  queryItems,
  queryAllItems,
  putItems,
  queryPaginatedItems,
} = require("../dist");

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

  it("should still navigate to the end", async () => {
    const pageSize = 11;

    const handleNavigation = async (currentPage, direction = "next") => {
      return queryPaginatedItems(
        "#PK = :PK",
        { PK },
        {
          TableName,
          IndexName: "booksByStars",
          pageSize,
          currentPage,
          direction,
        }
      );
    };

    const allItems = await queryAllItems(
      "#PK = :PK",
      { PK },
      { TableName, IndexName: "booksByStars" }
    );

    let pageResults = { hasNextPage: true };
    const pages = [];
    while (pageResults.hasNextPage) {
      const pageResult = await handleNavigation(pageResults.currentPage);
      pages.push(pageResult);
      pageResults = pageResult;
    }

    const itemsFromPages = pages.flatMap((p) => p.items);

    expect(JSON.stringify(itemsFromPages)).toEqual(JSON.stringify(allItems));
  });

  it("should still work in both directions", async () => {
    const pageSize = 12;

    const handleNavigation = async (currentPage, direction = "next") => {
      return queryPaginatedItems(
        "#PK = :PK",
        { PK },
        {
          TableName,
          IndexName: "booksByStars",
          pageSize,
          currentPage,
          direction,
        }
      );
    };

    const allItems = await queryAllItems(
      "#PK = :PK",
      { PK },
      { TableName, IndexName: "booksByStars" }
    );

    let pageResults = {};
    pageResults = await handleNavigation();
    expect(pageResults.items.length).toEqual(pageSize);
    expect(pageResults.hasPreviousPage).toEqual(false);
    expect(pageResults.hasNextPage).toEqual(true);

    const uniqueItems = [];
    const movesForward = 3;
    for (let i = 0; i < movesForward; i++) {
      pageResults = await handleNavigation(pageResults.currentPage, "next");
      uniqueItems.push(...pageResults.items.map((i) => i.SK));
      expect(pageResults.items.length).toEqual(pageSize);
      expect(pageResults.hasPreviousPage).toEqual(true);
      expect(pageResults.hasNextPage).toEqual(true);
    }
    expect(new Set(uniqueItems).size === pageSize * movesForward).toEqual(true);

    pageResults = await handleNavigation(pageResults.currentPage, "previous");
    expect(pageResults.items.length).toEqual(pageSize);

    expect(JSON.stringify(pageResults.items.map((i) => i.SK))).toEqual(
      JSON.stringify(
        allItems
          .slice(pageSize * (movesForward - 1), pageSize * movesForward)
          .map((i) => i.SK)
      )
    );

    pageResults = await handleNavigation(pageResults.currentPage, "next");
    uniqueItems.push(...pageResults.items.map((i) => i.SK));
    expect(pageResults.items.length).toEqual(pageSize);
    expect(pageResults.hasPreviousPage).toEqual(true);
    expect(pageResults.hasNextPage).toEqual(true);

    const movesBackward = movesForward;
    for (let i = 0; i < movesBackward; i++) {
      pageResults = await handleNavigation(pageResults.currentPage, "previous");
      expect(pageResults.currentPage.number).toEqual(3 - i);
      uniqueItems.push(...pageResults.items.map((i) => i.SK));
      expect(pageResults.items.length).toEqual(pageSize);
      expect(pageResults.hasPreviousPage).toEqual(i < movesBackward - 1);
      expect(pageResults.hasNextPage).toEqual(true);
    }
  });
});
