import { useEffect, useRef } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { pluginId } from '../shared/constants';
import { GraphQLDevToolEventMap } from '../shared/events';
import { GraphQLClientAdapter } from './adapters/types';
import { ApolloClientAdapter } from './adapters/apollo-adapter';
// Type aliases for GraphQL clients (optional dependencies - will be 'any' until installed)

type SupportedClientType = 'apollo' | 'custom';

interface UseGraphqlClientDevtoolConfig {
    /**
     * The GraphQL client instance
     */
    client: any;

    /**
     * Type of the GraphQL client
     */
    clientType: SupportedClientType;

    /**
     * Custom adapter implementation (required if clientType is 'custom')
     */
    adapter?: GraphQLClientAdapter;

    /**
     * Whether to include variables in operation tracking
     * @default true
     */
    includeVariables?: boolean;

    /**
     * Whether to include response data in operation tracking
     * @default true
     */
    includeResponseData?: boolean;
}

/**
 * Main hook for integrating GraphQL client with Rozenite DevTools.
 * 
 * This hook automatically tracks all GraphQL operations (queries, mutations, subscriptions)
 * including duplicate queries that might be deduplicated by your GraphQL client.
 * 
 * @example
 * ```typescript
 * // With Apollo Client
 * useGraphqlClientDevtool({
 *   client: apolloClient,
 *   clientType: 'apollo',
 * });
 * 
 * // With urql
 * useGraphqlClientDevtool({
 *   client: urqlClient,
 *   clientType: 'urql',
 * });
 * 
 * // With custom adapter
 * useGraphqlClientDevtool({
 *   client: myCustomClient,
 *   clientType: 'custom',
 *   adapter: new MyCustomAdapter(myCustomClient),
 * });
 * ```
 */
export const useGraphqlClientDevtool = (config: UseGraphqlClientDevtoolConfig) => {
    const {
        client,
        clientType,
        adapter: customAdapter,
        includeVariables = true,
        includeResponseData = true,
    } = config;

    const pluginClient = useRozeniteDevToolsClient<GraphQLDevToolEventMap>({
        pluginId: pluginId,
    });

    const adapterRef = useRef<GraphQLClientAdapter | null>(null);
    const isRecordingRef = useRef(false);

    // Create the appropriate adapter based on client type
    useEffect(() => {
        if (!pluginClient) {
            return;
        }

        let adapter: GraphQLClientAdapter;

        // Create adapter based on client type
        if (clientType === 'custom') {
            if (!customAdapter) {
                console.error('[GraphQL DevTools] Custom adapter is required when clientType is "custom"');
                return;
            }
            adapter = customAdapter;
        } else if (clientType === 'apollo') {
            adapter = new ApolloClientAdapter(client, { includeVariables, includeResponseData });
        } else {
            console.error(`[GraphQL DevTools] Unsupported client type: ${clientType}`);
            return;
        }

        adapterRef.current = adapter;
        adapter.initialize();

        // Set up operation tracking
        const unsubscribeOperation = adapter.onOperation((operation) => {
            // Only gate loading events with recording state to prevent orphaned operations
            // Always process completion/error events to avoid stuck loading states
            if (!isRecordingRef.current && (operation.status === 'loading' || !operation.status)) {
                return;
            }

            if (operation.status === 'loading' || !operation.status) {
                pluginClient.send('operation-start', { operation });
            }

            console.log('[GraphQL DevTools] Tracked operation:', operation.id, operation.status);

            // Handle completed operations
            // Note: Don't check for truthy data/error values - they can be null, undefined, false, 0, etc.
            if (operation.status === 'success') {
                pluginClient.send('operation-complete', {
                    id: operation.id,
                    data: operation.data,
                    duration: operation.duration || 0,
                    fromCache: operation.fromCache,
                });
            } else if (operation.status === 'error') {
                pluginClient.send('operation-error', {
                    id: operation.id,
                    error: operation.error,
                    duration: operation.duration || 0,
                });
            }
        });

        // Set up cache change tracking (if supported)
        let unsubscribeCache: (() => void) | undefined;
        if (adapter.onCacheChange) {
            unsubscribeCache = adapter.onCacheChange((entry) => {
                if (!isRecordingRef.current) return;
                pluginClient.send('cache-update', { entry });
            });
        }

        return () => {
            unsubscribeOperation();
            unsubscribeCache?.();
            adapter.cleanup();
            adapterRef.current = null;
        };
    }, [
        client,
        clientType,
        customAdapter,
        includeVariables,
        includeResponseData,
        pluginClient,
    ]);

    // Set up event listeners from panel
    useEffect(() => {
        if (!pluginClient || !adapterRef.current) {
            return;
        }

        const adapter = adapterRef.current;

        const subscriptions = [
            // Handle enable/disable recording
            pluginClient.onMessage('graphql-enable', () => {
                isRecordingRef.current = true;
            }),

            pluginClient.onMessage('graphql-disable', () => {
                isRecordingRef.current = false;
            }),

            // Handle cache snapshot request
            pluginClient.onMessage('get-cache-snapshot', () => {
                const entries = adapter.getCacheSnapshot();
                pluginClient.send('cache-snapshot', { entries });
            }),

            // Handle schema request
            pluginClient.onMessage('get-schema', async () => {
                try {
                    const schema = await adapter.getSchema();
                    pluginClient.send('schema-loaded', { schema });
                } catch (error) {
                    console.error('[GraphQL DevTools] Failed to load schema:', error);
                }
            }),

            // Handle clear operations
            pluginClient.onMessage('clear-operations', () => {
                // Operations are managed by the panel, so nothing to do here
            }),
        ];

        // Enable recording by default
        isRecordingRef.current = true;

        // Send initial cache snapshot
        const entries = adapter.getCacheSnapshot();
        pluginClient.send('cache-snapshot', { entries });

        // Request schema
        adapter.getSchema().then((schema) => {
            pluginClient.send('schema-loaded', { schema });
        }).catch((error) => {
            console.error('[GraphQL DevTools] Failed to load schema:', error);
        });

        return () => {
            subscriptions.forEach((subscription) => subscription.remove());
        };
    }, [pluginClient]);

    return pluginClient;
};

