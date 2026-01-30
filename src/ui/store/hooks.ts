import { useStore } from 'zustand';
import { store, GraphQLDevToolsState } from './store';

// Selectors
export const useIsRecording = () =>
  useStore(store, (state) => state.isRecording);

export const useSelectedOperationId = () =>
  useStore(store, (state) => state.selectedOperationId);

export const useOperations = () =>
  useStore(store, (state) => state.operations);

export const useCacheEntries = () =>
  useStore(store, (state) => state.cacheEntries);

export const useSchema = () =>
  useStore(store, (state) => state.schema);

export const useSelectedTab = () =>
  useStore(store, (state) => state.selectedTab);

export const useSelectedOperation = () => {
  const selectedId = useSelectedOperationId();
  const operations = useOperations();
  return selectedId ? operations.get(selectedId) : null;
};

export const useHasSelectedOperation = () => {
  const selectedId = useSelectedOperationId();
  return selectedId !== null;
};

// Actions
export const useActions = () =>
  useStore(store, (state) => state.actions);

export const useClientManagement = () =>
  useStore(store, (state) => state.client);

