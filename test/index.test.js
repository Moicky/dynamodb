require("dotenv/config");
const { client, TableName } = require("../dist");

describe("DynamoDB Setup", () => {
  it("should have read table name from env", () => {
    expect(TableName).toEqual(process.env.DYNAMODB_TABLE);
  });

  it("should have created a DynamoDB client", () => {
    expect(client).toBeDefined();
  });
});
