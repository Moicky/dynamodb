import { QueryCommandInput, ScanCommandInput } from "@aws-sdk/client-dynamodb";
import {
  marshall,
  marshallOptions,
  unmarshall,
  unmarshallOptions,
} from "@aws-sdk/util-dynamodb";

export declare interface DynamoDBFixes {
  disableConsistantReadWhenUsingIndexes?: {
    enabled: boolean;
    stillUseOnLocalIndexes?: string[];
  };
  marshallOptions?: marshallOptions;
  unmarshallOptions?: unmarshallOptions;
}

const defaults = {
  disableConsistantReadWhenQueryingIndexes: {
    enabled: true,
  },
  marshallOptions: {
    removeUndefinedValues: true,
  },
};

let fixes: DynamoDBFixes = defaults;

export const initFixes = (fixesConfig: DynamoDBFixes) => {
  fixes = fixesConfig;
};

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

export const withFixes = (
  args: Partial<QueryCommandInput> | Partial<ScanCommandInput>
) => {
  handleIndex(args);
  return args;
};

export const getDefaultFixes = () => defaults;

export const marshallWithOptions = (input: Parameters<typeof marshall>[0]) =>
  marshall(input, fixes.marshallOptions);

export const unmarshallWithOptions = (
  input: Parameters<typeof unmarshall>[0]
) => unmarshall(input, fixes.unmarshallOptions);
