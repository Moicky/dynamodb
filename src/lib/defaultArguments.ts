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
  transactGetItems,
  transactWriteItems,
  updateItem,
} from "../operations";

export interface OperationArguments {
  deleteItem?: Parameters<typeof deleteItem>[1];
  deleteItems?: Parameters<typeof deleteItems>[1];

  getItem?: Parameters<typeof getItem>[1];
  getItems?: Parameters<typeof getItems>[1];
  getAllItems?: Parameters<typeof getAllItems>[0];

  itemExists?: Parameters<typeof itemExists>[1];

  putItem?: Parameters<typeof putItem>[1];
  putItems?: Parameters<typeof putItems>[1];

  query?: Parameters<typeof query>[2];
  queryItems?: Parameters<typeof queryItems>[2];
  queryAllItems?: Parameters<typeof queryAllItems>[2];
  queryPaginatedItems?: Parameters<typeof queryPaginatedItems>[2];

  updateItem?: Parameters<typeof updateItem>[2];
  removeAttributes?: Parameters<typeof removeAttributes>[2];

  transactGetItems?: Parameters<typeof transactGetItems>[1];
  transactWriteItems?: Parameters<typeof transactWriteItems>[1];
}

let defaultArguments: OperationArguments = {};

/**
 * Initializes the default arguments to use for all operations.
 * @param args - The new default arguments to use for all operations {@link OperationArguments}
 * @returns void
 * @example
 * Enable consistent reads for all operations which support it:
 * ```javascript
 * initDefaultArguments({
 *   getItem: { ConsistentRead: true },
 *   getAllItems: { ConsistentRead: true },
 *
 *   itemExists: { ConsistentRead: true },
 *
 *   query: { ConsistentRead: true },
 *   queryItems: { ConsistentRead: true },
 *   queryAllItems: { ConsistentRead: true },
 *   queryPaginatedItems: { ConsistentRead: true, pageSize: 100 },
 * });
 * ```
 */
export const initDefaultArguments = (args: OperationArguments) => {
  defaultArguments = args;
};

/**
 * Returns the current default arguments used for all operations.
 * @returns The current default arguments {@link OperationArguments}
 */
export const getDefaultArguments = () => defaultArguments;

/**
 * Returns the current default arguments used for all operations.
 * @param args - The arguments to override the default arguments with
 * @param operation - The operation to get the default arguments for
 * @returns The merged arguments
 * @private
 */
export const withDefaults = <T extends keyof OperationArguments>(
  args: Partial<OperationArguments[T]>,
  operation: T
): OperationArguments[T] => {
  return {
    ...defaultArguments[operation],
    ...args,
  };
};
