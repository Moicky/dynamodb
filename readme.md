# @moicky/dynamodb

![](https://img.shields.io/github/actions/workflow/status/moicky/dynamodb/npm-publish.yml?label=build)
![](https://img.shields.io/github/actions/workflow/status/moicky/dynamodb/run-tests.yml?label=tests)
![](https://img.shields.io/github/languages/count/moicky/dynamodb)
![](https://img.shields.io/tokei/lines/github/moicky/dynamodb)

## Description

Contains convenience functions for all major dynamodb operations. Requires very little code to interact with items from aws dynamodb. Uses **aws sdk v3** and fixes several issues:

- 🎁 Will **automatically marshall and unmarshall** items
- 📦 Will **group items into batches** to avoid aws limits and improve performance
- ⏱ Will **automatically** add `createdAt` and `updatedAt` attributes on all items to track their most recent create/update operation timestamp. Example value: `Date.now() -> 1685138436000`
- 🔄 Will **retry** some operations (getItems, deleteItems) **up to 3 times** on unprocessed items
- 🔒 When specifying an item using its keySchema, all additional attributes (apart from **PK** and **SK**) will be removed to avoid errors
- 👻 Will **use placeholders** to avoid colliding with [reserved words](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html) if applicable

## Installation

```bash
npm i @moicky/dynamodb
```

## Setup

Requires a **keySchema** definition to be setup. Automatically grabs `DYNAMODB_TABLE` as an **environment variable** and uses `PK` and `SK` for it's schema. Can be overwritten using `initSchema` with multiple tables:

```ts
import { initSchema } from "@moicky/dynamodb";

// Should be called once at the start of the runtime before any operation is executed
initSchema({
  // first one will be used if no TableName is specified
  [process.env.DEFAULT_TABLE]: {
    hash: "PK",
    range: "SK",
  },
  [process.env.SECOND_TABLE]: {
    hash: "bookId",
  },
});
```

## Working with multiple tables

Every function accepts `args` which can include a `TableName` property that specifies the table and uses the keySchema from `initSchema()`

```ts
import { getItem, putItem, deleteItem } from "@moicky/dynamodb";

await putItem(
  {
    PK: "User/1",
    someSortKey: "Book/1",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    released: 1925,
  },
  { TableName: process.env.SECOND_TABLE }
);

const item = await getItem(
  { PK: "User/1", someSortKey: "Book/1" },
  { TableName: process.env.SECOND_TABLE }
);

await deleteItem(item, { TableName: process.env.SECOND_TABLE });
```

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

// Delete single item
await deleteItem({
  PK: "User/1",
  SK: "Book/1",
  title: "The Great Gatsby", // additional fields will be removed before sending to avoid errors
  author: "F. Scott Fitzgerald",
  released: 1925,
});

// Delete multiple items
// KeySchemas will be grouped into batches of 25 and will be retried up to 3 times if there are unprocessed items
// Will only delete each keySchema only once, even if it is present multiple times in the array to improve performance
await deleteItems([
  { PK: "User/1", SK: "Book/1" },
  // ... infinite more items (will be grouped into batches of 25 due to aws limit) and retried up to 3 times
]);
```

### Update Items

```ts
import { updateItem, removeAttributes } from "@moicky/dynamodb";

// Update the item and overwrite all supplied fields
await updateItem(
  { PK: "User/1", SK: "Book/1" },
  { description: "A book about a rich guy", author: "F. Scott Fitzgerald" }
);

await updateItem(
  { PK: "User/1", SK: "Book/1" },
  { released: 2000, maxReleased: 1950 }, // maxReleased will not be updated, since it is referenced inside the ConditionExpression
  { ConditionExpression: "#released < :maxReleased" }
);

const newItem = await updateItem(
  { PK: "User/1", SK: "Book/1" },
  { released: 2000 },
  { ReturnValues: "ALL_NEW" }
);
console.log(newItem); // { "PK": "User/1", "SK": "Book/1", "released": 2000 }

await removeAttributes({ PK: "User/1", SK: "Book/1" }, ["description"]);
```

### Query Items

```ts
import { query, queryItems, queryAllItems } from "@moicky/dynamodb";

// You HAVE TO use placeholders for the keyCondition & filterExpression:
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
  { FilterExpression: "#released BETWEEN :from AND :to" } // allows to override all args
);
```

### Miscellaneous

```ts
import { itemExists, getAscendingId } from "@moicky/dynamodb";

// Check if an item exists using keySchema
const exists = await itemExists({ PK: "User/1", SK: "Book/1" });

// Generate ascending ID
// Specify keySchemaHash and optionally item to start at using keySchemaRange

// Example Structure 1: PK: "User/1", SK: "{{ ASCENDING_ID }}"
// Last item: { PK: "User/1", SK: "00000009" }
const id1 = await getAscendingId({ PK: "User/1" });
console.log(id1); // "00000010"

// Example Structure 2: PK: "User/1", SK: "Book/{{ ASCENDING_ID }}"
// Last item: { PK: "User/1", SK: "Book/00000009" }
const id2 = await getAscendingId({ PK: "User/1", SKPrefix: "Book" });
console.log(id2); // "00000010"

// Specify length of ID
const id3 = await getAscendingId({ PK: "User/1", SKPrefix: "Book", length: 4 });
console.log(id3); // "0010"

// Example Structure 3: someKeySchemaHash: "User/1", SK: "Book/{{ ASCENDING_ID }}"
// Last item: { someKeySchemaHash: "User/1", SK: "Book/00000009" }
const id4 = await getAscendingId({
  someKeySchemaHash: "User/1",
  SKPrefix: "Book",
});
console.log(id4); // "00000010"
```

## Why should I use this?

Generally it makes it easier to interact with the dynamodb from AWS. Here are some before and after examples using the new aws-sdk v3:

### Put

```js
const demoItem = {
  PK: "User/1",
  SK: "Book/1",
  title: "The Great Gatsby",
  author: "F. Scott Fitzgerald",
  released: 1925,
};

// Without helpers:
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

const newItem = await client
  .send(
    new PutItemCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Item: marshall(demoItem),
      ReturnValues: "ALL_NEW",
    })
  )
  .then((result) => unmarshall(result.Attributes));

// With helpers:
import { putItem } from "@moicky/dynamodb";

const newItem = await putItem(demoItem, { ReturnValues: "ALL_NEW" });
```

### Query

```js
// Without helpers:
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

const results = await client
  .send(
    new QueryCommand({
      TableName: process.env.DYNAMODB_TABLE,
      KeyConditionExpression: "#PK = :PK and begins_with(#SK, :SK)",
      ExpressionAttributeNames: {
        "#PK": "PK",
        "#SK": "SK",
      },
      ExpressionAttributeValues: {
        ":PK": marshall("User/1"),
        ":SK": marshall("Book/"),
      },
    })
  )
  .then((result) => result.Items.map((item) => unmarshall(item)));

// With helpers
import { queryItems } from "@moicky/dynamodb";

const results = await queryItems("#PK = :PK and begins_with(#SK, :SK)", {
  PK: "User/1",
  SK: "Book/",
});
```

### Update

```js
// Without helpers
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

const result = await client
  .send(
    new UpdateItemCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Key: marshall({ PK: "User/1", SK: "Book/1" }),
      UpdateExpression: "SET #released = :released, #title = :title",
      ExpressionAttributeNames: {
        "#released": "released",
        "#title": "title",
      },
      ExpressionAttributeValues: marshall({
        ":released": 2000,
        ":title": "New Title",
      }),
      ReturnValues: "ALL_NEW",
    })
  )
  .then((result) => unmarshall(result.Attributes));

// With helpers
import { updateItem } from "@aws-sdk/lib-dynamodb";

const result = await updateItem(
  { PK: "User/1", SK: "Book/1" },
  { released: 2000, title: "New Title" },
  { ReturnValues: "ALL_NEW" }
);
```

## Tests

### Setup

Requires `DEFAULT_TABLE` and `SECOND_TABLE` to be present inside the environment (`.env file`)
Can be deployed using the `template.yml` on aws:

```bash
sam deploy
```

Will then return the table-names as the output of the template

### Execution

Finally executing all tests:

```bash
npm run test
```
