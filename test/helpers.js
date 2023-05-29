module.exports.generateItem = (namespace, id) => ({
  PK: namespace,
  SK: `Book/${id}`,
  title: "The Great Gatsby",
  author: "F. Scott Fitzgerald",
  released: 1925,
  genre: "Novel",
  pages: 218,
  stars: 5,
});
