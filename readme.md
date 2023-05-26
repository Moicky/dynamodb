# @moicky/dynamodb

## Stats

![](https://img.shields.io/github/languages/top/moicky/dynamodb)
![](https://img.shields.io/github/actions/workflow/status/moicky/dynamodb/npm-publish.yml)
![](https://img.shields.io/github/languages/code-size/moicky/dynamodb)
![](https://img.shields.io/snyk/vulnerabilities/github/moicky/dynamodb)
![](https://img.shields.io/github/languages/count/moicky/dynamodb)

## Description

Contains convenience functions for all major dynamodb operations. Requires very little code to interact with items from aws dynamodb. Uses **aws sdk v3** and fixes several issues:

- 🎁 Will **automatically marshall and unmarshall** items
- 📦 Will **group items into batches** to avoid aws limits and improve performance
- 🔄 Will **retry** some operations (getItems, deleteItems) **up to 3 times** on unprocessed items
- 🔒 When specifying an item using its keySchema, all additional attributes (apart from **PK** and **SK**) will be removed to avoid errors
- 👻 Will **use placeholders** to avoid colliding with [reserved words](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html) if applicable

## Installation

```bash
npm i @moicky/dynamodb
```

## Setup

Add `DYNAMODB_TABLE` as an **environment variable** containing the name of the dynamodb table. Also make sure to setup the required permissions to access the dynamodb table on aws or on your local machine. Also make sure to use `PK` and `SK` as keySchema attribute names in the table.

_Support for different keySchemas will follow 😉_

## Usage Examples

### Put Items

```ts
import { putItem, putItems } from "@moicky/dynamodb";

// Put single item into dynamodb
await putItem({
  PK: "User/1",
  SK: "Book/1",
  title: "The Great Gatsby",
  author: "F. Scott Fitzgerald",
  released: 1925,
});

// Put multiple items into dynamodb
await putItems([
  {
    PK: "User/1",
    SK: "Book/1",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    released: 1925,
  },
  // ... infinite more items (will be grouped into batches of 25 due to aws limit)
]);
```

### Get Items

```ts
import { getItem, getItems, getAllItems } from "@moicky/dynamodb";

// Passing more than just the key is possible, but will be removed to avoid errors

// Get single item
await getItem({
  PK: "User/1",
  SK: "Book/1",
  title: "The Great Gatsby", // additional fields will be removed before sending
  author: "F. Scott Fitzgerald",
  released: 1925,
});

// Get multiple items
// Items will be grouped into batches of 100 and will be retried up to 3 times if there are unprocessed items
// Will also only request each keySchema once, even if it is present multiple times in the array to improve performance
await getItems([
  {
    PK: "User/1",
    SK: "Book/1",
    title: "The Great Gatsby", // additional fields will be removed before sending
    author: "F. Scott Fitzgerald",
    released: 1925,
  },
  // ... infinite more items (will be grouped into batches of 100 due to aws limit) and retried up to 3 times
]);

// Retrieve all items using ScanCommand
await getAllItems();
```

### Delete Items

```ts
import { deleteItem, deleteItems } from "@moicky/dynamodb";

// Passing more than just the key is possible, but will be removed to avoid errors

// Delete single item
await deleteItem({
  PK: "User/1",
  SK: "Book/1",
  title: "The Great Gatsby", // additional fields will be removed before sending
  author: "F. Scott Fitzgerald",
  released: 1925,
});

// Delete multiple items
// Keys will be grouped into batches of 25 and will be retried up to 3 times if there are unprocessed items
// Will also only delete each keySchema once, even if it is present multiple times in the array to improve performance
await deleteItems([
  {
    PK: "User/1",
    SK: "Book/1",
    title: "The Great Gatsby", // additional fields will be removed before sending
    author: "F. Scott Fitzgerald",
    released: 1925,
  },
  // ... infinite more items (will be grouped into batches of 25 due to aws limit) and retried up to 3 times
]);
```

### Update Items

```ts
import { updateItem, removeAttributes } from "@moicky/dynamodb";

// Passing more than just the key is possible, but will be removed to avoid errors

// Update the item and overwrite all supplied fields
await updateItem(
  {
    PK: "User/1",
    SK: "Book/1",
    title: "The Great Gatsby", // additional fields will be removed before sending
  },
  { description: "A book about a rich guy", author: "F. Scott Fitzgerald" }
);

// Completely remove fields from the item
await removeAttributes(
  {
    PK: "User/1",
    SK: "Book/1",
    title: "The Great Gatsby", // additional fields will be removed before sending
  },
  ["description"]
);
```

### Query Items

```ts
import { query, queryItems, queryAllItems } from "@moicky/dynamodb";

// You have to use placeholders for the keyCondition & filterExpression:
// prefix the attributeNames with a hash (#) and the attributeValues with a colon (:)

// Query only using keyCondition and retrieve complete response
const booksResponse = await query("#PK = :PK and begins_with(#SK, :SK)", {
  PK: "User/1",
  SK: "Book/",
});

// Query and retrieve unmarshalled items array
const books = await queryItems("#PK = :PK and begins_with(#SK, :SK)", {
  PK: "User/1",
  SK: "Book/",
});

// Query and retry until all items are retrieved (due to aws limit of 1MB per query)
const allBooks = await queryAllItems("#PK = :PK and begins_with(#SK, :SK)", {
  PK: "User/1",
  SK: "Book/",
});

// Query with filterExpression (also specifiy attributes inside the key object)
const booksWithFilter = await queryAllItems(
  "#PK = :PK and begins_with(#SK, :SK)", // keyCondition
  {
    // definition for all attributes
    PK: "User/1",
    SK: "Book/",
    from: 1950,
    to: 2000,
  },
  // additional args with filterExpression
  { FilterExpression: "#released BETWEEN :from AND :to" }
);
```

### Miscellaneous

```ts
import { itemExists, getNewId } from "@moicky/dynamodb";

// Check if an item exists using keySchema
const exists = await itemExists({ PK: "User/1", SK: "Book/1" });

// Generate ascending ID
// Example Structure 1: PK: "User/1", SK: "{{ ASCENDING_ID }}"
// Last item: { PK: "User/1", SK: "00000009" }

const id1 = await getNewId({ PK: "User/1" });
console.log(id1); // "00000010"

// Example Structure 2: PK: "User/1", SK: "Book/{{ ASCENDING_ID }}"
// Last item: { PK: "User/1", SK: "Book/00000009" }

const id2 = await getNewId({ PK: "User/1", SK: "Book" });
console.log(id2); // "00000010"

// Specify length of ID
const id3 = await getNewId({ PK: "User/1", SK: "Book", length: 4 });
console.log(id3); // "0010"
```

## Tests

```bash
npm run test
```
