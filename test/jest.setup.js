const {
  getAllItems,
  deleteItems,
  putItems,
} = require("../dist/built/commonjs");
const { generateItem } = require("./helpers");

beforeAll(async () => {
  const allItems = await getAllItems();
  await deleteItems(allItems);

  await putItems(
    Array.from({ length: 10 }).map((_, i) => generateItem(i.toString()))
  );
});
