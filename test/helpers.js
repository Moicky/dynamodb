const PK = "User/0001";
module.exports.generateItem = (id) => ({
  PK,
  SK: `Book/${id}`,
  title: "The Great Gatsby",
  author: "F. Scott Fitzgerald",
  released: 1925,
});
module.exports.PK = PK;
