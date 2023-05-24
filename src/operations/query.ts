import {
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

import { client, TableName } from "../lib/client";
import {
  getAttributeNames,
  getAttributesFromExpression,
  getAttributeValues,
} from "../lib/helpers";

export async function query(
  keyCondition: string,
  key: any,
  args: Partial<QueryCommandInput> = {}
): Promise<QueryCommandOutput> {
  return client.send(
    new QueryCommand({
      TableName,
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
    })
  );
}

export async function queryItems(
  keyCondition: string,
  key: any,
  args: Partial<QueryCommandInput> = {}
): Promise<Record<string, any>[]> {
  return query(keyCondition, key, args).then((res) =>
    (res?.Items || []).map((item) => item && unmarshall(item))
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
  return (data?.Items || []).map((item) => item && unmarshall(item));
}
