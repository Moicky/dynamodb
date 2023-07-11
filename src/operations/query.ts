import {
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

import { client, getDefaultTable, withDefaults } from "../lib/client";
import {
  getAttributeNames,
  getAttributeValues,
  getAttributesFromExpression,
} from "../lib/helpers";

async function _query(
  keyCondition: string,
  key: any,
  args: Partial<QueryCommandInput> = {}
): Promise<QueryCommandOutput> {
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

export async function query(
  keyCondition: string,
  key: any,
  args?: Partial<QueryCommandInput>
): Promise<QueryCommandOutput> {
  return _query(keyCondition, key, withDefaults(args, "query"));
}

export async function queryItems(
  keyCondition: string,
  key: any,
  args: Partial<QueryCommandInput> = {}
): Promise<Record<string, any>[]> {
  args = withDefaults(args, "queryItems");

  return _query(keyCondition, key, args).then((res) =>
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
  args = withDefaults(args, "queryAllItems");

  let data = await _query(keyCondition, key, args);
  while (data.LastEvaluatedKey) {
    if (data.LastEvaluatedKey) {
      let helper = await _query(keyCondition, key, {
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
