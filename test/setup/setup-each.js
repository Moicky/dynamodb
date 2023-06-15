require("dotenv/config");

const { initSchema } = require("../../dist");

beforeAll(() => {
  initSchema({
    [process.env.DEFAULT_TABLE]: {
      hash: "PK",
      range: "SK",
    },
    [process.env.SECOND_TABLE]: {
      hash: "bookId",
    },
    [process.env.GSI_TABLE]: {
      hash: "PK",
      range: "SK",
    },
  });
});
