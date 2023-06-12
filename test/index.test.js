require("dotenv/config");

const { client, getDefaultTable, initSchema } = require("../dist");

initSchema({
  [process.env.DEFAULT_TABLE]: {
    hash: "PK",
    range: "SK",
  },
  [process.env.SECOND_TABLE]: {
    hash: "bookId",
  },
});

describe("DynamoDB Setup", () => {
  it("should have read table name from env", () => {
    expect(getDefaultTable()).toEqual(process.env.DEFAULT_TABLE);
  });

  it("should have created a DynamoDB client", () => {
    expect(client).toBeDefined();
  });
});
