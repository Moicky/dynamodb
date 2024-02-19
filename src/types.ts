export type DynamoDBItem = Record<string, any> & {
  createdAt?: number;
  updatedAt?: number;
};
