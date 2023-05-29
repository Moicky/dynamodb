require("dotenv/config");
const { getAllItems, deleteItems } = require("../dist");

module.exports = async () => {
  const allItems = await getAllItems();
  await deleteItems(allItems);
};
