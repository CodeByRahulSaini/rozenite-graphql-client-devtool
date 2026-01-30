// Core operation types
export type OperationType = 'query' | 'mutation' | 'subscription';
export type OperationStatus = 'pending' | 'loading' | 'success' | 'error';

// GraphQL Error type
export interface GraphQLError {
  message: string;
  locations?: Array<{
    line: number;
    column: number;
  }>;
  path?: (string | number)[];
  extensions?: Record<string, any>;
}

// Operation tracking
export interface GraphQLOperation {
  id: string;
  operationName: string;
  operationType: OperationType;
  query: string;
  variables?: Record<string, any>;
  timestamp: number;
  status: OperationStatus;
  duration?: number;
  data?: any;
  error?: GraphQLError;
  /**
   * Optional context data (excluded by default to avoid circular references)
   */
  context?: Record<string, any>;
  fromCache?: boolean;
}

// Cache entries
export interface CacheEntry {
  id: string;
  key: string;
  typename?: string;
  data: any;
  timestamp: number;
}

// Schema introspection types
export interface GraphQLArgument {
  name: string;
  type: string;
  defaultValue?: string;
  description?: string;
}

export interface GraphQLField {
  name: string;
  type: string;
  args?: GraphQLArgument[];
  description?: string;
  isDeprecated?: boolean;
  deprecationReason?: string;
}

export type GraphQLTypeKind = 
  | 'OBJECT' 
  | 'INTERFACE'
  | 'UNION'
  | 'ENUM'
  | 'INPUT_OBJECT'
  | 'SCALAR';

export interface GraphQLType {
  name: string;
  kind: GraphQLTypeKind;
  fields?: GraphQLField[];
  description?: string;
  interfaces?: string[];
  possibleTypes?: string[];
  enumValues?: string[];
}

export interface GraphQLSchema {
  queryType?: GraphQLType;
  mutationType?: GraphQLType;
  subscriptionType?: GraphQLType;
  types: GraphQLType[];
}

