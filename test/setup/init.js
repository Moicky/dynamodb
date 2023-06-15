require("dotenv/config");

const { initSchema, getAllItems, deleteItems } = require("../../dist");

const schema = {
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
};

initSchema(schema);

module.exports = async () => {
  for (const TableName of Object.keys(schema)) {
    const allItems = await getAllItems({ TableName });
    await deleteItems(allItems, { TableName });
  }
};
