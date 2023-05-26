import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
});

export const TableName = process.env.DYNAMODB_TABLE as string;

if (!TableName) {
  throw new Error("Missing DYNAMODB_TABLE environment variable");
}
