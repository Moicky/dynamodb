import { QueryCommandInput, ScanCommandInput } from "@aws-sdk/client-dynamodb";
import {
  marshall,
  marshallOptions,
  unmarshall,
  unmarshallOptions,
} from "@aws-sdk/util-dynamodb";

/**
 * DynamoDBFixes is a collection of fixes for DynamoDB.
 * @property disableConsistantReadWhenUsingIndexes - Disables ConsistentRead when using indexes.
 * @property marshallOptions - Options to pass to the [marshall](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/interfaces/_aws_sdk_util_dynamodb.marshallOptions.html) function.
 * @property unmarshallOptions - Options to pass to the [unmarshall](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/interfaces/_aws_sdk_util_dynamodb.unmarshallOptions.html) function.
 * @example
 * ```javascript
 * initFixes({
 *   disableConsistantReadWhenUsingIndexes: {
 *     enabled: true, // default,
 *
 *     // Won't disable ConsistantRead if IndexName is specified here.
 *     stillUseOnLocalIndexes: ["localIndexName1", "localIndexName1"],
 *   },
 * });
 * ```
 */
export declare interface DynamoDBFixes {
  disableConsistantReadWhenUsingIndexes?: {
    enabled: boolean;
    stillUseOnLocalIndexes?: string[];
  };
  marshallOptions?: marshallOptions;
  unmarshallOptions?: unmarshallOptions;
}

const defaults: DynamoDBFixes = Object.freeze({
  disableConsistantReadWhenUsingIndexes: {
    enabled: true,
  },
});

let fixes = defaults;

/**
 * Initializes the {@link DynamoDBFixes} to use for all operations.
 * @param fixesConfig - The new {@link DynamoDBFixes} to use
 * @returns void
 */
export const initFixes = (fixesConfig: DynamoDBFixes) => {
  fixes = fixesConfig;
};

/**
 * Returns the current {@link DynamoDBFixes} used for all operations.
 * @returns The current {@link DynamoDBFixes}
 * @private
 */
export const getFixes = () => fixes;

const handleIndex = (
  args: Partial<QueryCommandInput> | Partial<ScanCommandInput>
) => {
  if (
    fixes?.disableConsistantReadWhenUsingIndexes?.enabled &&
    args?.IndexName &&
    args?.ConsistentRead &&
    !fixes?.disableConsistantReadWhenUsingIndexes?.stillUseOnLocalIndexes?.includes(
      args?.IndexName
    )
  ) {
    args.ConsistentRead = false;
  }
};

/**
 * Returns the current {@link DynamoDBFixes} used for all operations.
 * @param args - The arguments to override the default arguments with
 * @returns The merged arguments
 * @private
 */
export const withFixes = (
  args: Partial<QueryCommandInput> | Partial<ScanCommandInput>
) => {
  handleIndex(args);
  return args;
};

/**
 * Returns the current {@link DynamoDBFixes} used for all operations.
 * @returns The current {@link DynamoDBFixes}
 * @private
 */
export const getDefaultFixes = () => defaults;

/**
 * Returns the current {@link DynamoDBFixes} used for all operations.
 * @param input - The input to marshall
 * @returns The marshalled input
 * @private
 */
export const marshallWithOptions = (input: Parameters<typeof marshall>[0]) =>
  marshall(input, fixes.marshallOptions);

/**
 * Returns the current {@link DynamoDBFixes} used for all operations.
 * @param input - The input to unmarshall
 * @returns The unmarshalled input
 * @private
 */
export const unmarshallWithOptions = (
  input: Parameters<typeof unmarshall>[0]
) => unmarshall(input, fixes.unmarshallOptions);
