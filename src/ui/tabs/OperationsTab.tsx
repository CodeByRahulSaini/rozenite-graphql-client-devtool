import { useState } from 'react';
import {
  useOperations,
  useActions,
  useSelectedOperationId,
} from '../store/hooks';
import { OperationsList } from './OperationsList';
import { OperationDetailPanel } from './OperationDetailPanel';
import { FilterBar, FilterState } from '../components/FilterBar';
import { OperationType } from '../../shared/types';

export function OperationsTab() {
  const operations = useOperations();
  const selectedOperationId = useSelectedOperationId();
  const { setSelectedOperation, clearOperations } = useActions();

  const [filter, setFilter] = useState<FilterState>({
    text: '',
    types: new Set<OperationType>(['query', 'mutation', 'subscription']),
  });

  // Convert operations Map to array and apply filters
  const operationsArray = Array.from(operations.values());
  const filteredOperations = operationsArray.filter((op) => {
    // Filter by type
    if (!filter.types.has(op.operationType)) {
      return false;
    }

    // Filter by search text
    if (filter.text) {
      const searchLower = filter.text.toLowerCase();
      return (
        op.operationName.toLowerCase().includes(searchLower) ||
        op.query.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  const selectedOperation = selectedOperationId
    ? operations.get(selectedOperationId)
    : null;

  return (
    <div className="flex flex-col h-full">
      <FilterBar
        filter={filter}
        onFilterChange={setFilter}
        onClear={clearOperations}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Operations List */}
        <div
          className={`flex flex-col ${
            selectedOperation ? 'w-1/2' : 'w-full'
          } border-r border-gray-700 overflow-hidden`}
        >
          <OperationsList
            operations={filteredOperations}
            selectedId={selectedOperationId}
            onSelect={setSelectedOperation}
          />
        </div>

        {/* Detail Panel */}
        {selectedOperation && (
          <OperationDetailPanel operation={selectedOperation} />
        )}
      </div>
    </div>
  );
}
