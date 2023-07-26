import {
  deleteItem,
  deleteItems,
  getAllItems,
  getItem,
  getItems,
  itemExists,
  putItem,
  putItems,
  query,
  queryAllItems,
  queryItems,
  queryPaginatedItems,
  removeAttributes,
  updateItem,
} from "../operations";

export interface OperationArguments {
  deleteItem?: Parameters<typeof deleteItem>[1];
  deleteItems?: Parameters<typeof deleteItems>[1];

  getItem?: Parameters<typeof getItem>[1];
  getItems?: Parameters<typeof getItems>[1];
  getAllItems?: Parameters<typeof getAllItems>[0];
  queryPaginatedItems?: Parameters<typeof queryPaginatedItems>[2];

  itemExists?: Parameters<typeof itemExists>[1];

  putItem?: Parameters<typeof putItem>[1];
  putItems?: Parameters<typeof putItems>[1];

  query?: Parameters<typeof query>[2];
  queryItems?: Parameters<typeof queryItems>[2];
  queryAllItems?: Parameters<typeof queryAllItems>[2];

  updateItem?: Parameters<typeof updateItem>[2];
  removeAttributes?: Parameters<typeof removeAttributes>[2];
}

let defaultArguments: OperationArguments = {};

export const initDefaultArguments = (args: OperationArguments) => {
  defaultArguments = args;
};

export const getDefaultArguments = () => defaultArguments;

export const withDefaults = <T extends keyof OperationArguments>(
  args: Partial<OperationArguments[T]>,
  operation: T
): OperationArguments[T] => {
  return {
    ...defaultArguments[operation],
    ...args,
  };
};
