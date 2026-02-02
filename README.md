# Rozenite GraphQL Client DevTool

A powerful debugging plugin for GraphQL clients in React Native applications, built for the Rozenite developer tools platform.

[![npm version](https://img.shields.io/npm/v/rozenite-graphql-client-devtool.svg)](https://www.npmjs.com/package/rozenite-graphql-client-devtool)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 📺 Demo

> **Coming Soon!** A comprehensive video demonstration will be added here showcasing all features and capabilities of the GraphQL Client DevTool in action.

<!-- 
📽️ Video Demo will be inserted here
Placeholder for video embed or link
-->

---

## 🌟 Overview

The Rozenite GraphQL Client DevTool provides a comprehensive debugging interface for monitoring and inspecting GraphQL operations in React Native applications. It supports multiple GraphQL clients through a flexible adapter pattern and offers real-time operation tracking, cache inspection, and schema exploration.

### Key Features

- 🔍 **Real-time Operation Tracking** - Monitor all GraphQL queries, mutations, and subscriptions as they happen
- 📊 **Cache Inspector** - Browse and explore your GraphQL client's cache entries
- 🗺️ **Schema Explorer** - Navigate through your GraphQL schema with detailed type information
- 🔌 **Multi-Client Support** - Built-in adapters for Apollo Client and urql, with support for custom adapters
- 🎯 **Filtering & Search** - Powerful filtering and search capabilities across all tabs
- 📝 **Detailed Inspection** - View query text, variables, response data, errors, and timing information

---

## 📦 Installation

```bash
# Using npm
npm install rozenite-graphql-client-devtool

# Using yarn
yarn add rozenite-graphql-client-devtool

# Using pnpm
pnpm add rozenite-graphql-client-devtool
```

### Peer Dependencies

This plugin requires the following peer dependencies:

```json
{
  "react": "*",
  "react-native": "*"
}
```

For Apollo Client support:
```bash
npm install @apollo/client graphql
```

For urql support:
```bash
npm install urql graphql
```

---

## 🚀 Quick Start

### With Apollo Client

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { useGraphqlClientDevtool } from 'rozenite-graphql-client-devtool';

// Create your Apollo Client
const client = new ApolloClient({
  uri: 'https://api.example.com/graphql',
  cache: new InMemoryCache(),
});

function App() {
  // Initialize the devtool
  useGraphqlClientDevtool({
    client,
    clientType: 'apollo',
  });

  return (
    <ApolloProvider client={client}>
      {/* Your app components */}
    </ApolloProvider>
  );
}
```

### With urql

```typescript
import { createClient } from 'urql';
import { useGraphqlClientDevtool } from 'rozenite-graphql-client-devtool';

// Create your urql client
const client = createClient({
  url: 'https://api.example.com/graphql',
});

function App() {
  // Initialize the devtool
  useGraphqlClientDevtool({
    client,
    clientType: 'urql',
  });

  return (
    <Provider value={client}>
      {/* Your app components */}
    </Provider>
  );
}
```

---

## 🔧 Configuration

### API Reference

#### `useGraphqlClientDevtool(config)`

The main hook for integrating your GraphQL client with Rozenite DevTools.

##### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `any` | **required** | Your GraphQL client instance (Apollo Client, urql, etc.) |
| `clientType` | `'apollo' \| 'urql' \| 'custom'` | **required** | The type of GraphQL client |
| `adapter` | `GraphQLClientAdapter` | `undefined` | Custom adapter implementation (required if `clientType` is `'custom'`) |
| `includeVariables` | `boolean` | `true` | Whether to include variables in operation tracking |
| `includeResponseData` | `boolean` | `true` | Whether to include response data in operation tracking |
| `enabled` | `boolean` | `true` | Whether the devtool is enabled |

##### Example with Options

```typescript
useGraphqlClientDevtool({
  client: apolloClient,
  clientType: 'apollo',
  includeVariables: true,
  includeResponseData: true,
  enabled: __DEV__, // Only enable in development
});
```

---

## 🎯 Features in Detail

### 1. Operations Tab

Monitor all GraphQL operations in real-time with comprehensive details.

**Features:**
- Real-time operation tracking with status indicators (pending, loading, success, error)
- Filter operations by type (Query, Mutation, Subscription)
- Search operations by name
- Sort by timestamp (newest first)
- Detailed operation view including:
  - GraphQL query/mutation text with syntax highlighting
  - Variables used in the operation
  - Response data in an interactive JSON tree view
  - Error details with location and path information
  - Timing information (duration)
  - Cache status and fetch policy
- Color-coded operation types and status badges
- Clear all operations button

### 2. Cache Tab

Inspect and explore your GraphQL client's cache entries.

**Features:**
- View all cache entries with their keys and data
- Group entries by typename for better organization
- Search and filter by key or typename
- Detailed cache entry viewer with interactive JSON tree
- Refresh button to request latest cache snapshot
- Entry metadata (timestamp, key, typename)
- Empty state when cache is empty

### 3. Explorer Tab

Browse your GraphQL schema and available operations.

**Features:**
- Display all available queries, mutations, and subscriptions
- Search through operations by name
- Filter by category (All, Queries, Mutations, Subscriptions)
- View detailed operation information:
  - Arguments with types, descriptions, and default values
  - Return types with nested field information
  - Field descriptions from schema
  - Deprecation warnings
- Expandable/collapsible operation details
- Color-coded by operation type
- Type system exploration

---

## 🔌 Custom Adapters

If you're using a GraphQL client that isn't Apollo or urql, you can create a custom adapter.

### Creating a Custom Adapter

```typescript
import { GraphQLClientAdapter, GraphQLOperation } from 'rozenite-graphql-client-devtool';

class MyCustomAdapter implements GraphQLClientAdapter {
  constructor(private client: MyGraphQLClient) {}

  // Subscribe to operations
  subscribeToOperations(callback: (operation: GraphQLOperation) => void): () => void {
    // Implement your subscription logic here
    const unsubscribe = this.client.on('operation', (op) => {
      callback({
        id: generateId(),
        operationName: op.name,
        operationType: op.type,
        query: op.query,
        variables: op.variables,
        status: 'loading',
        timestamp: Date.now(),
        // ... other required fields
      });
    });

    return unsubscribe;
  }

  // Subscribe to cache changes
  subscribeToCacheChanges(callback: (cacheSnapshot: any) => void): () => void {
    // Implement cache subscription logic
    return () => {}; // Return cleanup function
  }

  // Get current cache snapshot
  async getCacheSnapshot(): Promise<any> {
    return this.client.extract();
  }

  // Get schema information
  async getSchema(): Promise<any> {
    return this.client.getSchema();
  }
}

// Usage
useGraphqlClientDevtool({
  client: myCustomClient,
  clientType: 'custom',
  adapter: new MyCustomAdapter(myCustomClient),
});
```

### Adapter Interface

```typescript
interface GraphQLClientAdapter {
  /**
   * Subscribe to GraphQL operations
   * @param callback - Called when an operation is executed or updated
   * @returns Cleanup function to unsubscribe
   */
  subscribeToOperations(
    callback: (operation: GraphQLOperation) => void
  ): () => void;

  /**
   * Subscribe to cache changes
   * @param callback - Called when cache is updated
   * @returns Cleanup function to unsubscribe
   */
  subscribeToCacheChanges(
    callback: (cacheSnapshot: any) => void
  ): () => void;

  /**
   * Get current cache snapshot
   * @returns Promise resolving to cache data
   */
  getCacheSnapshot(): Promise<any>;

  /**
   * Get GraphQL schema
   * @returns Promise resolving to schema introspection result
   */
  getSchema(): Promise<any>;

  /**
   * Optional: Clear the cache
   */
  clearCache?(): Promise<void>;
}
```

---

## 🎨 UI Components

The devtool uses a modern, dark-themed UI built with:

- **Radix UI** - Accessible, unstyled component primitives
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library
- **React JSON Tree** - Interactive JSON viewer
- **TanStack Table** - Powerful table component
- **Zustand** - State management

---

## 🏗️ Architecture

### Directory Structure

```
rozenite-graphql-client-devtool/
├── src/
│   ├── react-native/          # React Native integration
│   │   ├── adapters/          # Client adapters
│   │   │   ├── apollo-adapter.ts
│   │   │   ├── urql-adapter.ts
│   │   │   └── types.ts
│   │   └── useGraphqlClientDevtool.ts
│   ├── ui/                    # DevTool UI components
│   │   ├── components/        # Reusable UI components
│   │   ├── tabs/             # Main tab components
│   │   ├── store/            # State management
│   │   └── App.tsx
│   └── shared/               # Shared types and constants
│       ├── types.ts
│       ├── events.ts
│       └── constants.ts
├── package.json
└── README.md
```

### Data Flow

1. **React Native App** → Initializes `useGraphqlClientDevtool` hook
2. **Hook** → Creates appropriate adapter based on client type
3. **Adapter** → Monitors GraphQL client operations and cache
4. **Plugin Bridge** → Sends events to DevTool UI
5. **DevTool UI** → Displays operations, cache, and schema information
6. **User** → Interacts with UI to inspect and debug

---

## 🛠️ Development

### Building the Plugin

```bash
# Install dependencies
pnpm install

# Build for production
pnpm build

# Development mode with hot reload
pnpm dev
```

### Project Structure

The plugin uses Vite for building and Rozenite's plugin architecture for seamless integration with the DevTools platform.

---

## 📚 TypeScript Support

This package is written in TypeScript and includes complete type definitions.

```typescript
import type {
  GraphQLOperation,
  GraphQLClientAdapter,
  OperationType,
  OperationStatus,
} from 'rozenite-graphql-client-devtool';
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Make your changes
4. Test your changes in the playground app
5. Submit a pull request

---

## 📄 License

MIT © [Your Name/Organization]

---

## 🙏 Acknowledgments

- Built on top of [Rozenite](https://github.com/yourusername/rozenite) - The React Native Developer Tools Platform
- Powered by [@rozenite/plugin-bridge](https://www.npmjs.com/package/@rozenite/plugin-bridge)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)

---

## 📞 Support

For issues, questions, or feature requests, please file an issue on [GitHub](https://github.com/yourusername/rozenite/issues).

---

## 🔮 Roadmap

- [ ] GraphQL subscriptions real-time visualization
- [ ] Performance metrics and slow query detection
- [ ] Cache diff viewer
- [ ] Export operations as cURL/code snippets
- [ ] Query response mocking
- [ ] GraphQL fragment tracking
- [ ] Advanced filtering with custom predicates
- [ ] Integration with more GraphQL clients (Relay, AWS Amplify, etc.)

---

**Made with ❤️ for React Native developers**
