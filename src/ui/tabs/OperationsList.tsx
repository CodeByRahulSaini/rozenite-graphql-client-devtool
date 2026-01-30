import { ScrollArea } from '../components/ScrollArea';
import { Badge } from '../components/Badge';
import { GraphQLOperation } from '../../shared/types';
import { Clock, Database } from 'lucide-react';

interface OperationsListProps {
  operations: GraphQLOperation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function OperationsList({
  operations,
  selectedId,
  onSelect,
}: OperationsListProps) {
  const getStatusBadgeVariant = (status: GraphQLOperation['status']) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'destructive';
      case 'loading':
        return 'warning';
      case 'pending':
        return 'pending';
      default:
        return 'default';
    }
  };

  const getOperationTypeColor = (type: GraphQLOperation['operationType']) => {
    switch (type) {
      case 'query':
        return 'text-blue-400';
      case 'mutation':
        return 'text-green-400';
      case 'subscription':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  if (operations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm">No operations yet</p>
          <p className="text-xs mt-1">Execute a GraphQL operation to see it here</p>
        </div>
      </div>
    );
  }

  // Sort operations by timestamp (newest first)
  const sortedOperations = [...operations].sort(
    (a, b) => b.timestamp - a.timestamp
  );

  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-gray-700">
        {sortedOperations.map((operation) => (
          <div
            key={operation.id}
            className={`p-3 cursor-pointer hover:bg-gray-800 transition-colors ${
              selectedId === operation.id ? 'bg-gray-800 border-l-2 border-blue-500' : ''
            }`}
            onClick={() => onSelect(operation.id)}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span
                  className={`text-xs font-mono font-semibold uppercase ${getOperationTypeColor(
                    operation.operationType
                  )}`}
                >
                  {operation.operationType}
                </span>
                <span className="text-sm font-medium text-gray-200 truncate">
                  {operation.operationName || 'Unnamed Operation'}
                </span>
              </div>
              <Badge
                variant={getStatusBadgeVariant(operation.status)}
                className="text-xs"
              >
                {operation.status}
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              {operation.duration !== undefined && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{operation.duration.toFixed(0)}ms</span>
                </div>
              )}
              {operation.fromCache && (
                <div className="flex items-center gap-1 text-yellow-400">
                  <Database className="h-3 w-3" />
                  <span>Cached</span>
                </div>
              )}
              <span className="ml-auto">
                {new Date(operation.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

