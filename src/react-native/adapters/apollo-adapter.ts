import {
    GraphQLOperation,
    CacheEntry,
    GraphQLSchema,
    OperationType,
} from '../../shared/types';
import { GraphQLClientAdapter, AdapterConfig } from './types';
import { gql, ApolloClient as ApolloClientType, NetworkStatus } from '@apollo/client';
import {
    getIntrospectionQuery,
    buildClientSchema,
    isObjectType,
    isInterfaceType,
    isUnionType,
    isEnumType,
    isInputObjectType,
    isScalarType,
    type DocumentNode,
    print,
} from 'graphql';

// Type alias for Apollo Client
type ApolloClient = ApolloClientType<any>;

// Private Apollo Client interfaces
interface PrivateObservableQuery {
    query: DocumentNode;
    variables: any;
    queryInfo?: {
        document: DocumentNode;
        variables: any;
        getDiff: () => { result: any };
    };
    pollingInfo?: { interval: number };
    getCurrentResult: (saveLastResult?: boolean) => {
        networkStatus: NetworkStatus;
        error?: any;
        data?: any;
    };
    getCacheDiff?: () => { result: any };
}

interface PrivateMutationStoreValue {
    mutation: DocumentNode;
    variables: any;
    loading: boolean;
    error: Error | null;
}

interface PrivateQueryManager {
    queries?: Map<string, any>;
    mutationStore?: Record<string, PrivateMutationStoreValue> | { getStore?: () => Record<string, PrivateMutationStoreValue> };
    getObservableQueries?: (include?: 'all' | 'active') => Map<string, any>;
}

interface PrivateApolloClient {
    queryManager: PrivateQueryManager;
    getObservableQueries?: (include?: 'all' | 'active') => Map<string, PrivateObservableQuery>;
}

/**
 * Apollo Client adapter for the GraphQL DevTools plugin.
 * 
 * This adapter integrates with Apollo Client using a polling-based approach,
 * similar to the official Apollo DevTools browser extension.
 * Instead of relying on __actionHookForDevTools (which was disabled in Apollo DevTools 4.4.3),
 * we poll the queryManager every 500ms to get the current state of queries and mutations.
 * 
 * @example
 * ```typescript
 * const adapter = new ApolloClientAdapter(apolloClient);
 * adapter.initialize();
 * ```
 */
export class ApolloClientAdapter implements GraphQLClientAdapter {
    private client: ApolloClient;
    private privateClient: PrivateApolloClient;
    private config: Required<AdapterConfig>;
    private operationCallbacks: Set<(operation: GraphQLOperation) => void> = new Set();
    private cacheCallbacks: Set<(entry: CacheEntry) => void> = new Set();
    private pollInterval: NodeJS.Timeout | null = null;
    private trackedQueries: Map<string, {
        status: 'loading' | 'success' | 'error';
        startTime: number;
        data?: any;
        error?: any;
        operationId?: string;
    }> = new Map();
    private trackedMutations: Map<number, boolean> = new Map();
    private operationCounter = 0;

    // ============================================================================
    // Constructor & Configuration
    // ============================================================================

    constructor(client: ApolloClient, config: AdapterConfig = {}) {
        this.client = client;
        this.privateClient = client as any as PrivateApolloClient;
        this.config = {
            includeVariables: config.includeVariables ?? true,
            includeResponseData: config.includeResponseData ?? true,
            maxOperations: config.maxOperations ?? 1000,
        };
    }

    // ============================================================================
    // Lifecycle Methods
    // ============================================================================

    initialize(): void {
        try {
            console.log('[Apollo Adapter] Initializing polling-based adapter (like official Apollo DevTools)');

            // Start polling queries and mutations every 500ms
            this.startPolling();

            console.log('[Apollo Adapter] Polling started successfully');
        } catch (error) {
            console.error('[Apollo Adapter] Failed to initialize:', error);
        }
    }

    cleanup(): void {
        // Stop polling
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }

        this.operationCallbacks.clear();
        this.cacheCallbacks.clear();
        this.trackedQueries.clear();
        this.trackedMutations.clear();
    }

    // ============================================================================
    // Polling Methods
    // ============================================================================

    /**
     * Start polling for queries and mutations.
     * This is how the official Apollo DevTools tracks operations in version 4.4.3+
     */
    private startPolling(): void {
        const interval = this.config.pollInterval ?? 500;
        // Poll at configured interval (default 500ms, same as official Apollo DevTools)
        this.pollInterval = setInterval(() => {
            this.pollQueries();
            this.pollMutations();
        }, interval);

        // Do an initial poll immediately
        this.pollQueries();
        this.pollMutations();
    }

    /**
     * Poll for active queries
     */
    private pollQueries(): void {
        try {
            const queries = this.getQueries();
            const currentQueryIds = new Set<string>();

            queries.forEach((queryDetails) => {
                const queryId = queryDetails.id;
                currentQueryIds.add(queryId);

                // Determine current status
                let currentStatus: 'loading' | 'success' | 'error';
                if (queryDetails.error) {
                    currentStatus = 'error';
                } else if (queryDetails.networkStatus === NetworkStatus.loading ||
                    queryDetails.networkStatus === NetworkStatus.setVariables ||
                    queryDetails.networkStatus === NetworkStatus.fetchMore ||
                    queryDetails.networkStatus === NetworkStatus.refetch) {
                    currentStatus = 'loading';
                } else {
                    currentStatus = 'success';
                }

                const tracked = this.trackedQueries.get(queryId);
                const now = Date.now();

                if (!tracked) {
                    // First time seeing this query - start tracking
                    const uniqueOpId = `query-${this.operationCounter++}-${Date.now()}`;
                    const currentData = queryDetails.data || queryDetails.cachedData;

                    this.trackedQueries.set(queryId, {
                        status: currentStatus,
                        startTime: now,
                        data: currentData,
                        error: queryDetails.error,
                        operationId: uniqueOpId,
                    });

                    // Only emit if it's loading (we'll emit completed state on transition)
                    if (currentStatus === 'loading') {
                        const operation = this.convertQueryToOperation(queryDetails, now, undefined, uniqueOpId, currentData);
                        this.notifyOperationCallbacks(operation);
                    }
                } else if (tracked.status !== currentStatus) {
                    // Status changed - this is a state transition we should track
                    const currentData = queryDetails.data || queryDetails.cachedData;

                    if (tracked.status === 'loading' && currentStatus !== 'loading') {
                        // Loading → Success/Error: Emit completed operation with duration
                        const duration = now - tracked.startTime;
                        const operation = this.convertQueryToOperation(queryDetails, tracked.startTime, duration, tracked.operationId, currentData);
                        this.notifyOperationCallbacks(operation);
                    } else if (currentStatus === 'loading') {
                        // New loading state (refetch) - generate new operation ID
                        const uniqueOpId = `query-${this.operationCounter++}-${Date.now()}`;
                        tracked.operationId = uniqueOpId;
                        // When starting a new fetch, we'll show incremental data on completion
                        const operation = this.convertQueryToOperation(queryDetails, now, undefined, uniqueOpId, currentData);
                        this.notifyOperationCallbacks(operation);
                    }

                    // Update tracking
                    this.trackedQueries.set(queryId, {
                        status: currentStatus,
                        startTime: currentStatus === 'loading' ? now : tracked.startTime,
                        data: currentData,
                        error: queryDetails.error,
                        operationId: tracked.operationId,
                    });
                } else if (currentStatus === 'success' && tracked.data !== (queryDetails.data || queryDetails.cachedData)) {
                    // Data changed but status stayed success - this is a refetch/update without loading state
                    // Generate new operation for this fetch
                    const uniqueOpId = `query-${this.operationCounter++}-${Date.now()}`;
                    const duration = 50; // Estimate for cache/instant updates
                    const currentData = queryDetails.data || queryDetails.cachedData;

                    this.trackedQueries.set(queryId, {
                        status: currentStatus,
                        startTime: now,
                        data: currentData,
                        error: queryDetails.error,
                        operationId: uniqueOpId,
                    });

                    // Emit as new operation with current data
                    const operation = this.convertQueryToOperation(queryDetails, now - duration, duration, uniqueOpId, currentData);
                    this.notifyOperationCallbacks(operation);
                }
            });

            // Clean up queries that no longer exist
            for (const [queryId] of this.trackedQueries) {
                if (!currentQueryIds.has(queryId)) {
                    this.trackedQueries.delete(queryId);
                }
            }
        } catch (error) {
            console.error('[Apollo Adapter] Error polling queries:', error);
        }
    }

    /**
     * Poll for mutations
     */
    private pollMutations(): void {
        try {
            const mutations = this.getMutations();

            mutations.forEach((mutationDetails, index) => {
                const wasLoading = this.trackedMutations.get(index);
                const isLoading = mutationDetails.loading;

                // Track status transitions: loading -> completed
                if (wasLoading === undefined) {
                    // First time seeing this mutation
                    this.trackedMutations.set(index, isLoading);
                    if (!isLoading) {
                        // Mutation already completed, emit it
                        const operation = this.convertMutationToOperation(mutationDetails, index);
                        this.notifyOperationCallbacks(operation);
                    }
                } else if (wasLoading === true && isLoading === false) {
                    // Mutation just completed
                    this.trackedMutations.set(index, false);
                    const operation = this.convertMutationToOperation(mutationDetails, index);
                    this.notifyOperationCallbacks(operation);
                }
            });
        } catch (error) {
            console.error('[Apollo Adapter] Error polling mutations:', error);
        }
    }

    /**
     * Get queries from Apollo Client (Apollo Client 3.x and 4.x compatible)
     */
    private getQueries(): Array<{
        id: string;
        document: DocumentNode;
        variables: any;
        cachedData: any;
        networkStatus: NetworkStatus;
        error?: any;
        pollInterval?: number;
    }> {
        try {
            const queryManager = this.privateClient.queryManager;

            // Try Apollo Client 3.4+ method
            if (this.privateClient.getObservableQueries) {
                return this.getQueriesModern(this.privateClient.getObservableQueries('active'));
            }
            // Try Apollo Client 3.4+ via queryManager
            else if (queryManager.getObservableQueries) {
                return this.getQueriesModern(queryManager.getObservableQueries('active'));
            }
            // Fallback to legacy method for Apollo Client < 3.4
            else if (queryManager.queries) {
                return this.getQueriesLegacy(queryManager.queries);
            }

            return [];
        } catch (error) {
            console.error('[Apollo Adapter] Error getting queries:', error);
            return [];
        }
    }

    /**
     * Get queries from Apollo Client 3.4+ (modern method)
     */
    private getQueriesModern(observableQueries: Map<string, any>): Array<any> {
        const queries: Array<any> = [];

        observableQueries.forEach((oq: PrivateObservableQuery, queryId: string) => {
            try {
                const { pollingInfo } = oq;
                const { networkStatus, error, data } = oq.getCurrentResult(false);

                // Get cached data
                let cachedData: any = null;
                if (oq.getCacheDiff) {
                    const diff = oq.getCacheDiff();
                    cachedData = diff.result;
                } else if (oq.queryInfo) {
                    const diff = oq.queryInfo.getDiff();
                    cachedData = diff.result;
                }

                queries.push({
                    id: queryId,
                    document: oq.queryInfo?.document || oq.query,
                    variables: oq.queryInfo?.variables || oq.variables,
                    cachedData,
                    networkStatus,
                    error,
                    data,
                    pollInterval: pollingInfo && Math.floor(pollingInfo.interval),
                });
            } catch (err) {
                console.warn('[Apollo Adapter] Error processing observable query:', err);
            }
        });

        return queries;
    }

    /**
     * Get queries from Apollo Client < 3.4 (legacy method)
     */
    private getQueriesLegacy(queryMap: Map<string, any>): Array<any> {
        const queries: Array<any> = [];

        queryMap.forEach((queryData: any, queryId: string) => {
            try {
                const { document, variables, diff, networkStatus } = queryData;
                queries.push({
                    id: queryId,
                    document,
                    variables,
                    cachedData: diff?.result,
                    networkStatus: networkStatus ?? NetworkStatus.ready,
                });
            } catch (err) {
                console.warn('[Apollo Adapter] Error processing legacy query:', err);
            }
        });

        return queries;
    }

    /**
     * Get mutations from Apollo Client
     */
    private getMutations(): Array<PrivateMutationStoreValue> {
        try {
            const mutationStore = this.privateClient.queryManager.mutationStore;

            if (!mutationStore) {
                return [];
            }

            // Handle different Apollo Client versions
            let mutationsObj: Record<string, PrivateMutationStoreValue>;

            if (typeof (mutationStore as any).getStore === 'function') {
                // Apollo Client 3.0 - 3.2
                mutationsObj = (mutationStore as any).getStore();
            } else {
                // Apollo Client 3.3+
                mutationsObj = mutationStore as Record<string, PrivateMutationStoreValue>;
            }

            return Object.values(mutationsObj);
        } catch (error) {
            console.error('[Apollo Adapter] Error getting mutations:', error);
            return [];
        }
    }

    /**
     * Convert query details to GraphQLOperation
     */
    private convertQueryToOperation(
        queryDetails: {
            id: string;
            document: DocumentNode;
            variables: any;
            cachedData: any;
            networkStatus: NetworkStatus;
            error?: any;
            data?: any;
            pollInterval?: number;
        },
        startTime: number,
        duration: number | undefined,
        operationId: string,
        responseData?: any
    ): GraphQLOperation {
        const { document, variables, cachedData, networkStatus, error, data } = queryDetails;

        // Determine status from network status
        let status: 'loading' | 'success' | 'error';
        if (error) {
            status = 'error';
        } else if (networkStatus === NetworkStatus.loading ||
            networkStatus === NetworkStatus.setVariables ||
            networkStatus === NetworkStatus.fetchMore ||
            networkStatus === NetworkStatus.refetch) {
            status = 'loading';
        } else {
            status = 'success';
        }

        // Extract operation name from document (search all definitions to handle fragments)
        const operationDef = document.definitions?.find((def: any) => def.kind === 'OperationDefinition');
        const operationName = operationDef?.name?.value || 'Unnamed Query';

        return {
            id: operationId,
            operationName,
            operationType: 'query',
            query: print(document),
            variables: this.config.includeVariables ? variables : undefined,
            timestamp: startTime,
            status,
            duration,
            data: this.config.includeResponseData ? (responseData ?? data ?? cachedData) : undefined,
            error: error ? {
                message: error.message || 'Query error',
                extensions: error.extensions,
            } : undefined,
            fromCache: networkStatus === NetworkStatus.ready && !!cachedData,
        };
    }

    /**
     * Convert mutation details to GraphQLOperation
     */
    private convertMutationToOperation(mutationDetails: PrivateMutationStoreValue, index: number): GraphQLOperation {
        const { mutation, variables, loading, error } = mutationDetails;

        // Extract operation name from document (search all definitions to handle fragments)
        const operationDef = mutation.definitions?.find((def: any) => def.kind === 'OperationDefinition');
        const operationName = operationDef?.name?.value || 'Unnamed Mutation';

        // Generate unique ID for each mutation execution
        const uniqueId = `mutation-${this.operationCounter++}-${Date.now()}`;

        return {
            id: uniqueId,
            operationName,
            operationType: 'mutation',
            query: print(mutation),
            variables: this.config.includeVariables ? variables : undefined,
            timestamp: Date.now(),
            status: error ? 'error' : loading ? 'loading' : 'success',
            // Mutations typically complete quickly, but we don't have precise timing in polling mode
            duration: loading ? undefined : 100, // Estimate ~100ms for completed mutations
            error: error ? {
                message: error.message || 'Mutation error',
            } : undefined,
        };
    }

    // ============================================================================
    // Public API Methods
    // ============================================================================

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
        return () => {
            this.cacheCallbacks.delete(callback);
        };
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Helper method to notify all operation callbacks
     */
    private notifyOperationCallbacks(operation: GraphQLOperation): void {
        this.operationCallbacks.forEach((callback) => {
            try {
                callback(operation);
            } catch (error) {
                console.error('[Apollo Adapter] Error in operation callback:', error);
            }
        });
    }
}

