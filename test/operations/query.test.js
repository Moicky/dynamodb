require("dotenv/config");

const exp = require("constants");
const {
  putItems,
  queryAllItems,
  queryItems,
  queryPaginatedItems,
} = require("../../dist");
const { generateItem: unwrappedGenerateItem } = require("../helpers");

const PK = "Operations/Query";
const generateItem = (id) => unwrappedGenerateItem(PK, id);

describe("query operations", () => {
  beforeAll(async () => {
    let items = [
      ...Array.from({ length: 100 }, (_, i) => generateItem(i.toString())),
      ...Array.from({ length: 0 }, (_, i) =>
        generateItem((500 + i).toString())
      ).map((b) => ({ ...b, released: 2010 })),
    ];
    await putItems(items);
  });

  it("should query items using PK", async () => {
    const items = await queryAllItems("#PK = :PK", { PK });
    expect(items.length).toEqual(600);
  });

  it("should query the last item", async () => {
    const items = await queryItems(
      "#PK = :PK",
      { PK },
      { ScanIndexForward: false, Limit: 1 }
    );
    expect(items.length).toEqual(1);
    expect(items[0].SK).toEqual("Book/99");
  });

  it("should perform complex filters", async () => {
    const items = await queryItems(
      "#PK = :PK",
      { PK, y1: 2000, y2: 2020 },
      { FilterExpression: "#released BETWEEN :y1 AND :y2" }
    );
    expect(items.length).toEqual(100);
    expect(items[0].released).toEqual(2010);
  });

  it("should work with a limit", async () => {
    const items = await queryAllItems("#PK = :PK", { PK }, { Limit: 10 });
    expect(items.length).toEqual(10);
  });

  it("should navigate to the end", async () => {
    const pageSize = 11;

    const handleNavigation = async (currentPage, direction = "next") => {
      return queryPaginatedItems(
        "#PK = :PK",
        { PK },
        { pageSize, currentPage, direction }
      );
    };

    const allItems = await queryAllItems("#PK = :PK", { PK });

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

  it("should work in both directions", async () => {
    const pageSize = 12;

    const handleNavigation = async (currentPage, direction = "next") => {
      return queryPaginatedItems(
        "#PK = :PK",
        { PK },
        { pageSize, currentPage, direction }
      );
    };

    const allItems = await queryAllItems("#PK = :PK", { PK });

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
