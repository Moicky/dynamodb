import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import "dotenv/config";

export const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
});

export const TableName = process.env.DYNAMODB_TABLE as string;
