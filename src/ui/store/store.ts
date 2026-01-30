import { createStore } from 'zustand';
import {
  GraphQLDevToolsClient,
  GraphQLDevToolEventMap,
} from '../../shared/events';
import {
  GraphQLOperation,
  CacheEntry,
  GraphQLSchema,
  OperationType,
} from '../../shared/types';

export interface GraphQLDevToolsState {
  // State
  isRecording: boolean;
  selectedOperationId: string | null;
  operations: Map<string, GraphQLOperation>;
  cacheEntries: Map<string, CacheEntry>;
  schema: GraphQLSchema | null;
  selectedTab: 'operations' | 'cache' | 'explorer';

  // Internal state
  _unsubscribeFunctions?: Array<{ remove: () => void }>;
  _client?: GraphQLDevToolsClient;

  // Actions
  actions: {
    setRecording: (isRecording: boolean) => void;
    setSelectedOperation: (operationId: string | null) => void;
    clearOperations: () => void;
    setSelectedTab: (tab: 'operations' | 'cache' | 'explorer') => void;
    requestCacheSnapshot: () => void;
    requestSchema: () => void;
  };

  // Event handling
  handleEvent: <K extends keyof GraphQLDevToolEventMap>(
    eventType: K,
    data: GraphQLDevToolEventMap[K]
  ) => void;

  // Client management
  client: {
    setupClient: (client: GraphQLDevToolsClient) => void;
    cleanupClient: () => void;
  };
}

export const createGraphQLDevToolsStore = () =>
  createStore<GraphQLDevToolsState>()((set, get) => ({
    // Initial state
    isRecording: true,
    selectedOperationId: null,
    operations: new Map(),
    cacheEntries: new Map(),
    schema: null,
    selectedTab: 'operations',

    // Actions
    actions: {
      setRecording: (isRecording: boolean) => {
        const { _client } = get();
        if (!_client) return;

        _client.send(isRecording ? 'graphql-enable' : 'graphql-disable', {});
        set({ isRecording });
      },

      setSelectedOperation: (operationId: string | null) =>
        set({ selectedOperationId: operationId }),

      clearOperations: () => {
        const { _client } = get();
        if (_client) {
          _client.send('clear-operations', {});
        }
        set({
          operations: new Map(),
          selectedOperationId: null,
        });
      },

      setSelectedTab: (tab: 'operations' | 'cache' | 'explorer') =>
        set({ selectedTab: tab }),

      requestCacheSnapshot: () => {
        const { _client } = get();
        if (_client) {
          _client.send('get-cache-snapshot', {});
        }
      },

      requestSchema: () => {
        const { _client } = get();
        if (_client) {
          _client.send('get-schema', {});
        }
      },
    },

    // Event handling
    handleEvent: <K extends keyof GraphQLDevToolEventMap>(
      eventType: K,
      data: GraphQLDevToolEventMap[K]
    ) => {
      switch (eventType) {
        case 'operation-start': {
          const eventData = data as GraphQLDevToolEventMap['operation-start'];
          set((state) => {
            const newOperations = new Map(state.operations);
            newOperations.set(eventData.operation.id, eventData.operation);
            return { operations: newOperations };
          });
          break;
        }

        case 'operation-update': {
          const eventData = data as GraphQLDevToolEventMap['operation-update'];
          set((state) => {
            const operation = state.operations.get(eventData.id);
            if (!operation) return state;

            const updatedOperation = {
              ...operation,
              ...eventData.updates,
            };

            const newOperations = new Map(state.operations);
            newOperations.set(eventData.id, updatedOperation);
            return { operations: newOperations };
          });
          break;
        }

        case 'operation-complete': {
          const eventData =
            data as GraphQLDevToolEventMap['operation-complete'];
          set((state) => {
            const operation = state.operations.get(eventData.id);
            if (!operation) return state;

            const updatedOperation: GraphQLOperation = {
              ...operation,
              status: 'success',
              data: eventData.data,
              duration: eventData.duration,
              fromCache: eventData.fromCache,
            };

            const newOperations = new Map(state.operations);
            newOperations.set(eventData.id, updatedOperation);
            return { operations: newOperations };
          });
          break;
        }

        case 'operation-error': {
          const eventData = data as GraphQLDevToolEventMap['operation-error'];
          set((state) => {
            const operation = state.operations.get(eventData.id);
            if (!operation) return state;

            const updatedOperation: GraphQLOperation = {
              ...operation,
              status: 'error',
              error: eventData.error,
              duration: eventData.duration,
            };

            const newOperations = new Map(state.operations);
            newOperations.set(eventData.id, updatedOperation);
            return { operations: newOperations };
          });
          break;
        }

        case 'cache-snapshot': {
          const eventData = data as GraphQLDevToolEventMap['cache-snapshot'];
          set(() => {
            const newCacheEntries = new Map<string, CacheEntry>();
            eventData.entries.forEach((entry) => {
              newCacheEntries.set(entry.id, entry);
            });
            return { cacheEntries: newCacheEntries };
          });
          break;
        }

        case 'cache-update': {
          const eventData = data as GraphQLDevToolEventMap['cache-update'];
          set((state) => {
            const newCacheEntries = new Map(state.cacheEntries);
            newCacheEntries.set(eventData.entry.id, eventData.entry);
            return { cacheEntries: newCacheEntries };
          });
          break;
        }

        case 'cache-invalidate': {
          const eventData = data as GraphQLDevToolEventMap['cache-invalidate'];
          set((state) => {
            const newCacheEntries = new Map(state.cacheEntries);
            eventData.keys.forEach((key) => {
              newCacheEntries.delete(key);
            });
            return { cacheEntries: newCacheEntries };
          });
          break;
        }

        case 'schema-loaded': {
          const eventData = data as GraphQLDevToolEventMap['schema-loaded'];
          set({ schema: eventData.schema });
          break;
        }
      }
    },

    // Client management
    client: {
      setupClient: (client: GraphQLDevToolsClient) => {
        const { handleEvent } = get();

        // Subscribe to all events using the unified handler
        const unsubscribeFunctions = [
          client.onMessage('operation-start', (data) =>
            handleEvent('operation-start', data)
          ),
          client.onMessage('operation-update', (data) =>
            handleEvent('operation-update', data)
          ),
          client.onMessage('operation-complete', (data) =>
            handleEvent('operation-complete', data)
          ),
          client.onMessage('operation-error', (data) =>
            handleEvent('operation-error', data)
          ),
          client.onMessage('cache-snapshot', (data) =>
            handleEvent('cache-snapshot', data)
          ),
          client.onMessage('cache-update', (data) =>
            handleEvent('cache-update', data)
          ),
          client.onMessage('cache-invalidate', (data) =>
            handleEvent('cache-invalidate', data)
          ),
          client.onMessage('schema-loaded', (data) =>
            handleEvent('schema-loaded', data)
          ),
        ];

        // Store unsubscribe functions in the state for cleanup
        set({
          _unsubscribeFunctions: unsubscribeFunctions,
          _client: client,
        });

        // Request initial data
        client.send('get-schema', {});
        client.send('get-cache-snapshot', {});
      },

      cleanupClient: () => {
        const { _unsubscribeFunctions, _client } = get();

        if (_unsubscribeFunctions) {
          _unsubscribeFunctions.forEach((unsubscribe) => unsubscribe.remove());
        }

        if (_client) {
          _client.send('graphql-disable', {});
        }

        set({
          _unsubscribeFunctions: undefined,
          _client: undefined,
        });
      },
    },
  }));

export const store = createGraphQLDevToolsStore();

