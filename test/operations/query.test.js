const { queryAllItems, queryItems, putItems } = require("../../dist");
const { generateItem, PK } = require("../helpers");

describe("query operations", () => {
  beforeAll(async () => {
    let items = [
      ...Array.from({ length: 500 }, (_, i) => generateItem(i.toString())),
      ...Array.from({ length: 100 }, (_, i) =>
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
});
