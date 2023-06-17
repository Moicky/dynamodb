import {
  QueryCommand,
  QueryCommandInput as _QueryCommandInput,
  QueryCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

import { client, getDefaultTable } from "../lib/client";
import {
  getAttributeNames,
  getAttributeValues,
  getAttributesFromExpression,
  handleAliases,
} from "../lib/helpers";

const aliases = {
  IndexName: ["GSI", "Index"],
};

type QueryCommandInput = {
  GSI: _QueryCommandInput["IndexName"];
  Index: _QueryCommandInput["IndexName"];
} & _QueryCommandInput;

export async function query(
  keyCondition: string,
  key: any,
  args: Partial<QueryCommandInput> = {}
): Promise<QueryCommandOutput> {
  args = handleAliases(aliases, args);
  return client.send(
    new QueryCommand({
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: getAttributeValues(key, [
        ...getAttributesFromExpression(keyCondition, ":"),
        ...getAttributesFromExpression(args?.FilterExpression || "", ":"),
      ]),
      ExpressionAttributeNames: getAttributeNames(key, [
        ...getAttributesFromExpression(keyCondition),
        ...getAttributesFromExpression(args?.FilterExpression || ""),
      ]),
      ...args,
      TableName: args?.TableName || getDefaultTable(),
    })
  );
}

export async function queryItems(
  keyCondition: string,
  key: any,
  args: Partial<QueryCommandInput> = {}
): Promise<Record<string, any>[]> {
  return query(keyCondition, key, args).then((res) =>
    (res?.Items || [])
      .map((item) => item && unmarshall(item))
      .filter((item) => item)
  );
}

export async function queryAllItems(
  keyCondition: string,
  key: any,
  args: Partial<QueryCommandInput> = {}
): Promise<Record<string, any>[]> {
  let data = await query(keyCondition, key, args);
  while (data.LastEvaluatedKey) {
    if (data.LastEvaluatedKey) {
      let helper = await query(keyCondition, key, {
        ...args,
        ExclusiveStartKey: data.LastEvaluatedKey,
      });
      if (helper?.Items && data?.Items) {
        data.Items.push(...helper.Items);
      }
      data && (data.LastEvaluatedKey = helper.LastEvaluatedKey);
    }
  }
  return (data?.Items || [])
    .map((item) => item && unmarshall(item))
    .filter((item) => item);
}
