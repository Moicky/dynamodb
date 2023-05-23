const { query, queryAllItems, queryItems } = require("../../dist");
const { generateItem, PK } = require("../helpers");

describe("query operations", () => {
  it("should query items using PK", async () => {
    const items = await queryItems("#PK = :PK", { PK });
    expect(items.length).toEqual(10);
  });
});
