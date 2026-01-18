import { QueryCommandInput, ScanCommandInput } from "@aws-sdk/client-dynamodb";
import {
  marshall,
  marshallOptions,
  unmarshall,
  unmarshallOptions,
} from "@aws-sdk/util-dynamodb";
import { DynamoDBItem } from "../types";

/**
 * DynamoDBConfig is a collection of fixes or configurations for DynamoDB and this package.
 * @property disableConsistantReadWhenUsingIndexes - Disables ConsistentRead when using indexes.
 * @property marshallOptions - Options to pass to the [marshall](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/interfaces/_aws_sdk_util_dynamodb.marshallOptions.html) function.
 * @property unmarshallOptions - Options to pass to the [unmarshall](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/interfaces/_aws_sdk_util_dynamodb.unmarshallOptions.html) function.
 * @property splitTransactionsIfAboveLimit - Splits a transaction into multiple, if more than [100 operations](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html) are provided.
 * @property itemModificationTimestamp - A function that returns the value of the `createdAt` and `updatedAt` attributes for an item when it is created or updated.
 * @example
 * ```javascript
 * initConfig({
 *   disableConsistantReadWhenUsingIndexes: {
 *     enabled: true, // default,
 *
 *     // Won't disable ConsistantRead if IndexName is specified here.
 *     stillUseOnLocalIndexes: ["localIndexName1", "localIndexName1"],
 *   },
 * });
 * ```
 */
export declare interface DynamoDBConfig {
  disableConsistantReadWhenUsingIndexes?: {
    enabled: boolean;
    stillUseOnLocalIndexes?: string[];
  };
  marshallOptions?: marshallOptions;
  unmarshallOptions?: unmarshallOptions;
  splitTransactionsIfAboveLimit?: boolean;
  itemModificationTimestamp?: (field: "createdAt" | "updatedAt") => any;
}

const defaultConfig: DynamoDBConfig = Object.freeze({
  disableConsistantReadWhenUsingIndexes: {
    enabled: true,
  },
  itemModificationTimestamp: (_) => Date.now(),
} satisfies DynamoDBConfig);

let config = defaultConfig;

/**
 * Initializes the {@link DynamoDBConfig} to use for all operations.
 * @param newConfig - The new {@link DynamoDBConfig} to use, will be merged with the default config.
 * @returns void
 */
export const initConfig = (newConfig: DynamoDBConfig) => {
  config = { ...defaultConfig, ...newConfig };
};

/**
 * Returns the current {@link DynamoDBConfig} used for all operations.
 * @returns The current {@link DynamoDBConfig}
 * @private
 */
export const getConfig = () => config;

const handleIndex = (
  args: Partial<QueryCommandInput> | Partial<ScanCommandInput>
) => {
  if (
    config?.disableConsistantReadWhenUsingIndexes?.enabled &&
    args?.IndexName &&
    args?.ConsistentRead &&
    !config?.disableConsistantReadWhenUsingIndexes?.stillUseOnLocalIndexes?.includes(
      args?.IndexName
    )
  ) {
    args.ConsistentRead = false;
  }
};

/**
 * Applies fixes & configurations for the arguments for Query/Scan operations.
 * @param args - The arguments to override the default arguments with
 * @returns The merged arguments
 * @private
 */
export const withConfig = (
  args: Partial<QueryCommandInput> | Partial<ScanCommandInput>
) => {
  handleIndex(args);
  return args;
};

/**
 * Returns the default {@link DynamoDBConfig} used for all operations.
 * @returns The current {@link DynamoDBConfig}
 * @private
 */
export const getDefaultConfig = () => defaultConfig;

/**
 * Marshalls the input using {@link marshall} with the global options.
 * @param input - The input to marshall
 * @returns The marshalled input
 * @private
 */
export const marshallWithOptions = (input: Parameters<typeof marshall>[0]) =>
  marshall(input, config.marshallOptions);

/**
 * Unmarshalls the input using {@link unmarshall} with the global options.
 * @param input - The input to unmarshall
 * @returns The unmarshalled input
 * @private
 */
export const unmarshallWithOptions = <T extends DynamoDBItem = DynamoDBItem>(
  input: Parameters<typeof unmarshall>[0]
) => unmarshall(input, config.unmarshallOptions) as T;

/**
 * Returns the timestamp for the item modification field.
 * @param field - The field to get the timestamp for
 * @returns The timestamp
 * @private
 */
export const getItemModificationTimestamp = (
  field: "createdAt" | "updatedAt"
) => config.itemModificationTimestamp?.(field) ?? Date.now();
