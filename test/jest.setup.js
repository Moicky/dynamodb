require("dotenv/config");

const { initSchema, getAllItems, deleteItems } = require("../dist");

initSchema({
  [process.env.DEFAULT_TABLE]: {
    hash: "PK",
    range: "SK",
  },
  [process.env.SECOND_TABLE]: {
    hash: "bookId",
  },
});

module.exports = async () => {
  for (const TableName of [
    process.env.DEFAULT_TABLE,
    process.env.SECOND_TABLE,
  ]) {
    const allItems = await getAllItems({ TableName });
    await deleteItems(allItems, { TableName });
  }
};
