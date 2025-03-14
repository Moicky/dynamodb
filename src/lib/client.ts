import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getDefaultTableSchema, initSchema } from "./schemas";

const authTypes = {
  vercel: () => {
    if (!process.env.AWS_ROLE_ARN) return {};

    return {
      credentials: import("@vercel/functions/oidc").then(
        ({ awsCredentialsProvider }) => ({
          credentials: awsCredentialsProvider({
            roleArn: process.env.AWS_ROLE_ARN,
            roleSessionName: "moicky-dynamodb",
          }),
        })
      ),
    };
  },
  assumeRole: () => {
    if (!process.env.DYNAMODB_ASSUME_ROLE) return {};

    return {
      credentials: import("@aws-sdk/credential-providers").then(
        ({ fromTemporaryCredentials }) =>
          fromTemporaryCredentials({
            params: {
              RoleArn: process.env.DYNAMODB_ASSUME_ROLE,
              RoleSessionName: "moicky-dynamodb",
            },
          })
      ),
    };
  },
} as const;
type AuthType = keyof typeof authTypes;
const _authType = process.env.MOICKY_DYNAMODB_AWS_ROLE as AuthType;

const authType = authTypes[_authType];

let client = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
  ...(authType && (authType() as any)),
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
