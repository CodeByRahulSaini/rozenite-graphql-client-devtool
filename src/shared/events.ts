import { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  GraphQLOperation,
  CacheEntry,
  GraphQLSchema,
  GraphQLError,
  OperationType,
} from './types';

export type GraphQLDevToolEventMap = {
  // Control
  'graphql-enable': unknown;
  'graphql-disable': unknown;

  // Operations
  'operation-start': {
    operation: GraphQLOperation;
  };
  'operation-update': {
    id: string;
    updates: Partial<GraphQLOperation>;
  };
  'operation-complete': {
    id: string;
    data: any;
    duration: number;
    fromCache?: boolean;
  };
  'operation-error': {
    id: string;
    error: GraphQLError;
    duration: number;
  };

  // Cache
  'cache-snapshot': {
    entries: CacheEntry[];
  };
  'cache-update': {
    entry: CacheEntry;
  };
  'cache-invalidate': {
    keys: string[];
  };
  'get-cache-snapshot': unknown;

  // Schema/Explorer
  'schema-loaded': {
    schema: GraphQLSchema;
  };
  'get-schema': unknown;

  // Actions from panel to RN
  'clear-operations': unknown;
  'execute-operation': {
    query: string;
    variables?: Record<string, any>;
    operationType: OperationType;
  };
};

export type GraphQLDevToolsClient = RozeniteDevToolsClient<GraphQLDevToolEventMap>;

