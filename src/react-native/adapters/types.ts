import {
  GraphQLOperation,
  CacheEntry,
  GraphQLSchema,
} from '../../shared/types';

/**
 * Base adapter interface that all GraphQL client adapters must implement.
 * This allows the plugin to work with multiple GraphQL clients (Apollo, urql, etc.)
 */
export interface GraphQLClientAdapter {
  /**
   * Initialize the adapter and set up interceptors/listeners
   */
  initialize(): void;

  /**
   * Clean up resources and remove interceptors/listeners
   */
  cleanup(): void;

  /**
   * Get a snapshot of the current cache state
   * @returns Array of cache entries
   */
  getCacheSnapshot(): CacheEntry[];

  /**
   * Get the GraphQL schema from the client
   * @returns Promise resolving to the schema
   */
  getSchema(): Promise<GraphQLSchema>;

  /**
   * Register a callback to be notified of GraphQL operations
   * @param callback Function to call when an operation occurs
   * @returns Cleanup function to remove the listener
   */
  onOperation(callback: (operation: GraphQLOperation) => void): () => void;

  /**
   * Optional: Watch for cache changes
   * @param callback Function to call when cache changes
   * @returns Cleanup function to remove the listener
   */
  onCacheChange?(callback: (entry: CacheEntry) => void): () => void;
}

/**
 * Configuration options for creating an adapter
 */
export interface AdapterConfig {
  /**
   * Whether to include variables in operation tracking (may contain sensitive data)
   */
  includeVariables?: boolean;

  /**
   * Whether to include response data in operation tracking
   */
  includeResponseData?: boolean;

  /**
   * Maximum number of operations to keep in memory
   */
  maxOperations?: number;

  /**
   * Polling interval in milliseconds for tracking operations (default: 500)
   */
  pollInterval?: number;
}

