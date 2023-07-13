import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getDefaultTableSchema, initSchema } from "./schemas";

let client = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
});

const defaultTable = process.env.DYNAMODB_TABLE as string;

if (defaultTable) {
  initSchema({ [defaultTable]: getDefaultTableSchema() });
}

export const initClient = (newClient: DynamoDBClient) => {
  client = newClient;
};

export const getClient = () => client;
