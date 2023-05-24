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
      ExpressionAttributeValues: getAttributeValues(key),
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
  const attributesToGet = keyCondition && args?.AttributesToGet;
  if (attributesToGet) delete args.AttributesToGet;

  return query(keyCondition, key, args).then((res) => {
    const items = (res?.Items || []).map((item) => item && unmarshall(item));

    if (attributesToGet) {
      return items.map((item) =>
        attributesToGet.reduce((acc, cur) => ({ ...acc, [cur]: item[cur] }), {})
      );
    }
    return items;
  });
}

export async function queryAllItems(
  keyCondition: string,
  key: any,
  args: Partial<QueryCommandInput> = {}
): Promise<Record<string, any>[]> {
  const attributesToGet = keyCondition && args?.AttributesToGet;
  if (attributesToGet) delete args.AttributesToGet;

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
  const items = (data?.Items || []).map((item) => item && unmarshall(item));
  if (attributesToGet) {
    return items.map((item) =>
      attributesToGet.reduce((acc, cur) => ({ ...acc, [cur]: item[cur] }), {})
    );
  }
  return items;
}
