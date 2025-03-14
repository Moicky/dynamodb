import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { getDefaultTableSchema, initSchema } from "./schemas";

const authType = process.env.MOICKY_DYNAMODB_AWS_ROLE;
const roleArn = process.env.AWS_ROLE_ARN;
let client = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
  ...(authType === "vercel" &&
    roleArn && { credentials: awsCredentialsProvider({ roleArn }) }),
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
