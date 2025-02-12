import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { getDefaultTableSchema, initSchema } from "./schemas";

let client = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
  ...(process.env.DYNAMODB_ASSUME_ROLE && {
    credentials: fromTemporaryCredentials({
      params: {
        RoleArn: process.env.DYNAMODB_ASSUME_ROLE,
        RoleSessionName: "@moicky/dynamodb",
      },
    }),
  }),
});

const defaultTable = process.env.DYNAMODB_TABLE as string;

if (defaultTable) {
  initSchema({ [defaultTable]: getDefaultTableSchema() });
}

/**
 * Initializes the {@link DynamoDBClient} to use for all operations.
 * @param newClient - The new {@link DynamoDBClient} to use
 */
export const initClient = (newClient: DynamoDBClient) => {
  client = newClient;
};

/**
 * Returns the current {@link DynamoDBClient} used for all operations.
 * @returns The current {@link DynamoDBClient}
 */
export const getClient = () => client;
