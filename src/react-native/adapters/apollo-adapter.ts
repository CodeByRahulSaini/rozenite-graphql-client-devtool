import {
    GraphQLOperation,
    CacheEntry,
    GraphQLSchema,
    OperationType,
} from '../../shared/types';
import { GraphQLClientAdapter, AdapterConfig } from './types';
import { ApolloLink, Observable, gql, ApolloClient as ApolloClientType, Operation, FetchResult } from '@apollo/client';
import { 
    getIntrospectionQuery, 
    buildClientSchema,
    isObjectType,
    isInterfaceType,
    isUnionType,
    isEnumType,
    isInputObjectType,
    isScalarType,
} from 'graphql';

// Type alias for Apollo Client
type ApolloClient = ApolloClientType<any>;

/**
 * Apollo Client adapter for the GraphQL DevTools plugin.
 * 
 * This adapter integrates with Apollo Client to track operations,
 * inspect cache, and extract schema information.
 * 
 * @example
 * ```typescript
 * const adapter = new ApolloClientAdapter(apolloClient);
 * adapter.initialize();
 * ```
 */
export class ApolloClientAdapter implements GraphQLClientAdapter {
    private client: ApolloClient;
    private config: Required<AdapterConfig>;
    private operationCallbacks: Set<(operation: GraphQLOperation) => void> = new Set();
    private cacheCallbacks: Set<(entry: CacheEntry) => void> = new Set();
    private operationMap: Map<string, { startTime: number; operation: GraphQLOperation }> = new Map();

    constructor(client: ApolloClient, config: AdapterConfig = {}) {
        this.client = client;
        this.config = {
            includeVariables: config.includeVariables ?? true,
            includeResponseData: config.includeResponseData ?? true,
            maxOperations: config.maxOperations ?? 1000,
        };
    }

    initialize(): void {
        try {
            // Create a custom link to track operations
            const devToolsLink = new ApolloLink((operation: Operation, forward) => {
                const startTime = Date.now();
                const operationId = `${operation.operationName || 'unnamed'}-${startTime}-${Math.random().toString(36).substr(2, 9)}`;

                // Extract operation details
                const operationType = this.getOperationType(operation.query.definitions[0]);
                const operationName = operation.operationName || 'Unnamed Operation';
                const query = operation.query.loc?.source?.body || '';
                const variables = this.config.includeVariables ? operation.variables : undefined;

                // Create operation object (exclude context to avoid circular references)
                const graphqlOperation: GraphQLOperation = {
                    id: operationId,
                    operationName,
                    operationType,
                    query,
                    variables,
                    timestamp: startTime,
                    status: 'loading',
                };

                // Store operation with start time
                this.operationMap.set(operationId, { startTime, operation: graphqlOperation });

                // Notify that operation has started
                this.notifyOperationCallbacks(graphqlOperation);

                // Forward the operation and track the result
                return new Observable((observer) => {
                    const subscription = forward(operation).subscribe({
                        next: (result: FetchResult) => {
                            const duration = Date.now() - startTime;
                            const storedOp = this.operationMap.get(operationId);

                            if (storedOp) {
                                const completedOperation: GraphQLOperation = {
                                    ...storedOp.operation,
                                    status: result.errors ? 'error' : 'success',
                                    duration,
                                    data: this.config.includeResponseData ? result.data : undefined,
                                    error: result.errors?.[0] ? {
                                        message: result.errors[0].message,
                                        locations: result.errors[0].locations,
                                        path: result.errors[0].path,
                                        extensions: result.errors[0].extensions,
                                    } : undefined,
                                    fromCache: result.data && operation.getContext().cache === 'cache-only',
                                };

                                this.notifyOperationCallbacks(completedOperation);
                                this.operationMap.delete(operationId);
                            }

                            observer.next(result);
                        },
                        error: (error: any) => {
                            const duration = Date.now() - startTime;
                            const storedOp = this.operationMap.get(operationId);

                            if (storedOp) {
                                const errorOperation: GraphQLOperation = {
                                    ...storedOp.operation,
                                    status: 'error',
                                    duration,
                                    error: {
                                        message: error.message || 'An error occurred',
                                        extensions: error.extensions,
                                    },
                                };

                                this.notifyOperationCallbacks(errorOperation);
                                this.operationMap.delete(operationId);
                            }

                            observer.error(error);
                        },
                        complete: () => {
                            observer.complete();
                        },
                    });

                    return () => {
                        subscription.unsubscribe();
                    };
                });
            });

            // Prepend the devtools link to the existing link chain
            const existingLink = this.client.link;
            this.client.setLink(devToolsLink.concat(existingLink));

            console.log('[Apollo Adapter] Initialized with operation tracking');
        } catch (error) {
            console.error('[Apollo Adapter] Failed to initialize:', error);
        }
    }

    cleanup(): void {
        this.operationCallbacks.clear();
        this.cacheCallbacks.clear();
    }

    getCacheSnapshot(): CacheEntry[] {
        try {
            // Extract cache data from Apollo Client
            const cacheData = this.client.cache.extract();
            const entries: CacheEntry[] = [];

            Object.entries(cacheData).forEach(([key, value]) => {
                entries.push({
                    id: key,
                    key: key,
                    typename: (value as any)?.__typename,
                    data: value,
                    timestamp: Date.now(),
                });
            });

            return entries;
        } catch (error) {
            console.error('[Apollo Adapter] Failed to extract cache:', error);
            return [];
        }
    }

    async getSchema(): Promise<GraphQLSchema> {
        try {
            // Execute introspection query
            const result = await this.client.query({
                query: gql(getIntrospectionQuery()),
                fetchPolicy: 'network-only',
            });

            if (!result.data) {
                console.warn('[Apollo Adapter] No schema data returned');
                return { types: [] };
            }

            // Build client schema from introspection result
            const schema = buildClientSchema(result.data);

            // Extract query, mutation, and subscription types
            const queryType = schema.getQueryType();
            const mutationType = schema.getMutationType();
            const subscriptionType = schema.getSubscriptionType();

            // Helper to convert fields
            const convertFields = (fields: any) => {
                if (!fields) return undefined;

                return Object.values(fields).map((field: any) => ({
                    name: field.name,
                    type: field.type.toString(),
                    description: field.description,
                    args: field.args?.map((arg: any) => ({
                        name: arg.name,
                        type: arg.type.toString(),
                        description: arg.description,
                        defaultValue: arg.defaultValue,
                    })),
                    isDeprecated: field.isDeprecated,
                    deprecationReason: field.deprecationReason,
                }));
            };

            // Extract all types from schema
            const typeMap = schema.getTypeMap();
            const allTypes = Object.values(typeMap)
                .filter((type: any) => {
                    // Filter out built-in types (starting with __)
                    return !type.name.startsWith('__');
                })
                .map((type: any) => {
                    // Determine type kind using GraphQL type guards
                    let kind: 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'SCALAR' = 'OBJECT';
                    if (isScalarType(type)) {
                        kind = 'SCALAR';
                    } else if (isEnumType(type)) {
                        kind = 'ENUM';
                    } else if (isInputObjectType(type)) {
                        kind = 'INPUT_OBJECT';
                    } else if (isInterfaceType(type)) {
                        kind = 'INTERFACE';
                    } else if (isUnionType(type)) {
                        kind = 'UNION';
                    } else if (isObjectType(type)) {
                        kind = 'OBJECT';
                    }

                    const typeObj: any = {
                        name: type.name,
                        kind,
                        description: type.description,
                    };

                    // Add fields for object and interface types
                    if ((isObjectType(type) || isInterfaceType(type) || isInputObjectType(type)) && type.getFields) {
                        try {
                            typeObj.fields = convertFields(type.getFields());
                        } catch (e) {
                            // Some types might not have fields
                        }
                    }

                    // Add enum values
                    if (isEnumType(type) && type.getValues) {
                        try {
                            typeObj.enumValues = type.getValues().map((v: any) => v.name);
                        } catch (e) {
                            // Error getting enum values
                        }
                    }

                    // Add interfaces (for object types)
                    if (isObjectType(type) && type.getInterfaces) {
                        try {
                            typeObj.interfaces = type.getInterfaces().map((i: any) => i.name);
                        } catch (e) {
                            // No interfaces
                        }
                    }

                    // Add possible types for unions/interfaces
                    if ((isUnionType(type) || isInterfaceType(type)) && schema.getPossibleTypes) {
                        try {
                            typeObj.possibleTypes = schema.getPossibleTypes(type).map((t: any) => t.name);
                        } catch (e) {
                            // No possible types
                        }
                    }

                    return typeObj;
                });

            return {
                queryType: queryType ? {
                    name: queryType.name,
                    kind: 'OBJECT' as const,
                    fields: convertFields(queryType.getFields()),
                    description: queryType.description,
                } : undefined,
                mutationType: mutationType ? {
                    name: mutationType.name,
                    kind: 'OBJECT' as const,
                    fields: convertFields(mutationType.getFields()),
                    description: mutationType.description,
                } : undefined,
                subscriptionType: subscriptionType ? {
                    name: subscriptionType.name,
                    kind: 'OBJECT' as const,
                    fields: convertFields(subscriptionType.getFields()),
                    description: subscriptionType.description,
                } : undefined,
                types: allTypes,
            };
        } catch (error) {
            console.error('[Apollo Adapter] Failed to fetch schema:', error);
            return { types: [] };
        }
    }

    onOperation(callback: (operation: GraphQLOperation) => void): () => void {
        this.operationCallbacks.add(callback);
        return () => {
            this.operationCallbacks.delete(callback);
        };
    }

    onCacheChange(callback: (entry: CacheEntry) => void): () => void {
        this.cacheCallbacks.add(callback);

        // TODO: Set up cache watcher
        // Apollo provides cache.watch() for this

        return () => {
            this.cacheCallbacks.delete(callback);
        };
    }

    /**
     * Helper method to extract operation type from Apollo operation definition
     */
    private getOperationType(operationDefinition: any): OperationType {
        if (!operationDefinition) return 'query';

        const operation = operationDefinition.operation;

        switch (operation) {
            case 'query':
                return 'query';
            case 'mutation':
                return 'mutation';
            case 'subscription':
                return 'subscription';
            default:
                return 'query';
        }
    }

    /**
     * Helper method to notify all operation callbacks
     */
    private notifyOperationCallbacks(operation: GraphQLOperation): void {
        // Enforce maxOperations limit
        if (this.operationMap.size >= this.config.maxOperations) {
            // Remove oldest operation
            const firstKey = this.operationMap.keys().next().value;
            if (firstKey) {
                this.operationMap.delete(firstKey);
            }
        }

        this.operationCallbacks.forEach((callback) => {
            try {
                callback(operation);
            } catch (error) {
                console.error('[Apollo Adapter] Error in operation callback:', error);
            }
        });
    }
}

