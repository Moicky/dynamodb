# @moicky/dynamodb

![](https://img.shields.io/github/actions/workflow/status/moicky/dynamodb/npm-publish.yml?label=build)
![](https://img.shields.io/github/actions/workflow/status/moicky/dynamodb/run-tests.yml?label=tests)

## Description

Contains convenience functions for all major dynamodb operations. Requires very little code to interact with items from aws dynamodb. Uses **aws sdk v3** and fixes several issues:

- 🎁 Will **automatically marshall and unmarshall** items
- 📦 Will **group items into batches** to avoid aws limits and improve performance
- ⏱ Will **automatically** add `createdAt` and `updatedAt` attributes on all items to track their most recent create/update operation timestamp. Example value: `Date.now() -> 1685138436000`
- 🔄 Will **retry** `getItems`, `deleteItems` **up to 3 times** on unprocessed items and `queryAllItems` until finished
- 🔒 When specifying an item using its keySchema, all additional attributes (apart from keySchema attributes from `initSchema` or `PK` & `SK` as default) will be removed to avoid errors
- 👻 Will **use placeholders** to avoid colliding with [reserved words](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html) if applicable
- 🌎 Supports globally defined default arguments for each operation ([example](#configuring-global-defaults))
- 🔨 Supports fixes for several issues with dynamodb ([example](#applying-fixes))
- 📖 Offers a convenient way to use pagination with queries ([example](#paginated-items))
- 🗂️ Supports **transactGetItems** & **transactWriteItems**

## Installation

```bash
npm i @moicky/dynamodb
```

## Setup

Automatically grabs `DYNAMODB_TABLE` as an **environment variable** and assumes `PK` and `SK` as it's schema. Can be customized using `initSchema` with one or more tables:

```ts
import { initSchema } from "@moicky/dynamodb";

// Should be called once at the start of the runtime before any operation is executed
initSchema({
  // first one will be used by default if no TableName is specified when calling functions
  [process.env.DEFAULT_TABLE]: {
    hash: "PK",
    range: "SK",
  },
  [process.env.SECOND_TABLE]: {
    hash: "somePK",
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

Every put operation also adds the `createdAt` attribute with the current timestamp on each item.

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

// Delete a single item
await deleteItem({
  PK: "User/1",
  SK: "Book/1",
  title: "The Great Gatsby", // additional fields will be removed before sending to avoid errors
  author: "F. Scott Fitzgerald",
  released: 1925,
});

// Delete multiple items
// Will only delete each keySchema once, even if it is present multiple times in the array to improve performance and avoid aws errors
await deleteItems([
  { PK: "User/1", SK: "Book/1" },
  // ... infinite more items (will be grouped into batches of 25 due to aws limit) and retried up to 3 times
]);
```

### Update Items

Every update operation also upserts the `updatedAt` attribute with the current timestamp on each item.

```ts
import { updateItem, removeAttributes } from "@moicky/dynamodb";

// Update the item and overwrite all supplied fields
await updateItem(
  { PK: "User/1", SK: "Book/1" }, // reference to item
  { description: "A book about a rich guy", author: "F. Scott Fitzgerald" } // fields to update
);

await updateItem(
  { PK: "User/1", SK: "Book/1" },
  { released: 2000, maxReleased: 1950 }, // maxReleased will not be updated on the item, since it is referenced inside the ConditionExpression
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
// Prefix the attributeNames with a hash (#) and the attributeValues with a colon (:)

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
  // additional args with filterExpression for example
  { FilterExpression: "#released BETWEEN :from AND :to" }
);
```

#### Paginated Items

```ts
// Pagination
const { items, hasNextPage, hasPreviousPage, currentPage } =
  await queryPaginatedItems(
    "#PK = :PK and begins_with(#SK, :SK)",
    { PK: "User/1", SK: "Book/" },
    { pageSize: 100 }
  );
// items: The items on the current page.
// currentPage: { number: 1, firstKey: { ... }, lastKey: { ... } }

const { items: nextItems, currentPage: nextPage } = await queryPaginatedItems(
  "#PK = :PK and begins_with(#SK, :SK)",
  { PK: "User/1", SK: "Book/" },
  { pageSize: 100, currentPage } // args.direction: 'next' or 'previous'
);
// items: The items on the second page.
// currentPage: { number: 2, firstKey: { ... }, lastKey: { ... } }
```

### Miscellaneous

```ts
import { itemExists, getAscendingId } from "@moicky/dynamodb";

// Check if an item exists using keySchema
const exists = await itemExists({ PK: "User/1", SK: "Book/1" });
console.log(exists); // true or false

// Generate ascending ID
// Specify Partition-Key and optionally the Sort-Key.

// Example Structure 1: PK: "User/1", SK: "{{ ASCENDING_ID }}"
// Last item: { PK: "User/1", SK: "00000009" }
const id1 = await getAscendingId({ PK: "User/1" });
console.log(id1); // "00000010"

// Example Structure 2: PK: "User/1", SK: "Book/{{ ASCENDING_ID }}"
// Last item: { PK: "User/1", SK: "Book/00000009" }
const id2 = await getAscendingId({ PK: "User/1", SK: "Book/" });
console.log(id2); // "00000010"

// Specify length of ID
const id3 = await getAscendingId({ PK: "User/1", SK: "Book/", length: 4 });
console.log(id3); // "0010"

// Example Structure 3: somePartitionKey: "User/1", SK: "Book/{{ ASCENDING_ID }}"
// Last item: { somePartitionKey: "User/1", SK: "Book/00000009" }
const id4 = await getAscendingId({
  somePartitionKey: "User/1",
  SK: "Book/",
});
console.log(id4); // "00000010"
```

## Configuring global defaults

Global defaults can be configured using the `initDefaults` function. This allows to provide but still override every property of the `args` parameter.

Should be called before any DynamoDB operations are performed.

```ts
import { initDefaultArguments, getItem } from "@moicky/dynamodb";

// This example enables consistent reads for all DynamoDB operations which support it.
initDefaultArguments({
  getItem: { ConsistentRead: true },
  getAllItems: { ConsistentRead: true },

  itemExists: { ConsistentRead: true },

  query: { ConsistentRead: true },
  queryItems: { ConsistentRead: true },
  queryAllItems: { ConsistentRead: true },
});

// It is still possible to override any arguments when calling a function
const itemWithoutConsistentRead = await getItem(
  { PK: "User/1", SK: "Book/001" },
  { ConsistentRead: false }
);
```

## Applying fixes

Arguments which are passed to [marshall](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/interfaces/_aws_sdk_util_dynamodb.marshallOptions.html) and [unmarshall](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/interfaces/_aws_sdk_util_dynamodb.unmarshallOptions.html) from `@aws-sdk/util-dynamodb` can be configured using

```ts
import { initFixes } from "@moicky/dynamodb";

initFixes({
  marshallOptions: {
    removeUndefinedValues: true,
  },
  unmarshallOptions: {
    wrapNumbers: true,
  },
});
```

When using `GlobalSecondaryIndexes`, DynamoDb does not support using `ConsistantRead`. This is fixed by default (`ConsistantRead` is turned off) and can be configured using:

```ts
import { initFixes } from "@moicky/dynamodb";

initFixes({
  disableConsistantReadWhenUsingIndexes: {
    enabled: true, // default,

    // Won't disable ConsistantRead if IndexName is specified here.
    // This works because DynamoDB supports ConsistantRead on LocalSecondaryIndexes
    stillUseOnLocalIndexes: ["localIndexName1", "localIndexName2"],
  },
});
```

## What are the benefits and why should I use it?

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

Requires environment variables to be present for the tests to successfully connect to dynamodb tables. You can find a list of required environment variables here:
[.env.template](.env.template)

They can be obtained using the **template.yml** which can be deployed on aws using:

```bash
sam deploy
```

Will then return the table-names as the output of the template

### Execution

Finally executing all tests:

```bash
npm run test
```
