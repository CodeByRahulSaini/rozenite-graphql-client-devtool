import { Search, Trash2 } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';

export type OperationType = 'query' | 'mutation' | 'subscription';

export interface FilterState {
  text: string;
  types: Set<OperationType>;
}

interface FilterBarProps {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  onClear?: () => void;
}

export function FilterBar({ filter, onFilterChange, onClear }: FilterBarProps) {
  const handleTypeToggle = (type: OperationType) => {
    const newTypes = new Set(filter.types);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    onFilterChange({ ...filter, types: newTypes });
  };

  return (
    <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search operations..."
          value={filter.text}
          onChange={(e) => onFilterChange({ ...filter, text: e.target.value })}
          className="h-8 pl-8 text-sm bg-gray-700 border-gray-600"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.types.has('query')}
            onChange={() => handleTypeToggle('query')}
            className="rounded"
          />
          Query
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.types.has('mutation')}
            onChange={() => handleTypeToggle('mutation')}
            className="rounded"
          />
          Mutation
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.types.has('subscription')}
            onChange={() => handleTypeToggle('subscription')}
            className="rounded"
          />
          Subscription
        </label>
      </div>
      {onClear && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="h-8 px-2"
          title="Clear all operations"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
