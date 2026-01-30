import { useState, useEffect } from 'react';
import { Search, ChevronRight, ChevronDown } from 'lucide-react';
import { useSchema, useActions } from '../store/hooks';
import { ScrollArea } from '../components/ScrollArea';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { GraphQLType, GraphQLField } from '../../shared/types';

export function ExplorerTab() {
  const schema = useSchema();
  const { requestSchema } = useActions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<GraphQLType | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<'all' | 'query' | 'mutation' | 'subscription'>('all');

  useEffect(() => {
    // Request schema when tab is mounted
    requestSchema();
  }, [requestSchema]);

  const toggleExpanded = (typeName: string) => {
    setExpandedTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(typeName)) {
        newSet.delete(typeName);
      } else {
        newSet.add(typeName);
      }
      return newSet;
    });
  };

  if (!schema) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">📖</div>
          <p className="text-sm">Loading schema...</p>
          <p className="text-xs mt-1">Fetching GraphQL schema information</p>
        </div>
      </div>
    );
  }

  // Get root operation types
  const queries = schema.queryType?.fields || [];
  const mutations = schema.mutationType?.fields || [];
  const subscriptions = schema.subscriptionType?.fields || [];

  // Filter operations based on search and category
  const filterOperations = (operations: GraphQLField[]) => {
    if (!searchTerm) return operations;
    const searchLower = searchTerm.toLowerCase();
    return operations.filter((op) =>
      op.name.toLowerCase().includes(searchLower) ||
      (op.description && op.description.toLowerCase().includes(searchLower))
    );
  };

  const filteredQueries = filterOperations(queries);
  const filteredMutations = filterOperations(mutations);
  const filteredSubscriptions = filterOperations(subscriptions);

  const OperationField = ({ field, typeName }: { field: GraphQLField; typeName: string }) => {
    const isExpanded = expandedTypes.has(`${typeName}.${field.name}`);
    
    return (
      <div className="mb-1">
        <div
          className="flex items-start gap-2 p-2 rounded cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => toggleExpanded(`${typeName}.${field.name}`)}
        >
          <div className="mt-0.5">
            {field.args && field.args.length > 0 ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )
            ) : (
              <div className="w-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-blue-400">{field.name}</span>
              <span className="text-xs text-gray-500">→</span>
              <span className="text-xs font-mono text-green-400">{field.type}</span>
              {field.isDeprecated && (
                <Badge variant="warning" className="text-xs">
                  Deprecated
                </Badge>
              )}
            </div>
            {field.description && (
              <p className="text-xs text-gray-400 mt-1">{field.description}</p>
            )}
            {field.deprecationReason && (
              <p className="text-xs text-yellow-400 mt-1">
                ⚠️ {field.deprecationReason}
              </p>
            )}
          </div>
        </div>
        
        {isExpanded && field.args && field.args.length > 0 && (
          <div className="ml-8 mt-1 p-2 bg-gray-800 rounded">
            <h5 className="text-xs font-semibold text-gray-400 mb-2 uppercase">
              Arguments
            </h5>
            {field.args.map((arg) => (
              <div key={arg.name} className="mb-2 last:mb-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-purple-400">{arg.name}</span>
                  <span className="text-xs text-gray-500">:</span>
                  <span className="text-xs font-mono text-green-400">{arg.type}</span>
                  {arg.defaultValue && (
                    <span className="text-xs text-gray-500">
                      = {arg.defaultValue}
                    </span>
                  )}
                </div>
                {arg.description && (
                  <p className="text-xs text-gray-400 mt-1 ml-2">{arg.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search operations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-sm bg-gray-700 border-gray-600"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-2 py-1 text-xs rounded ${
              filterCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterCategory('query')}
            className={`px-2 py-1 text-xs rounded ${
              filterCategory === 'query'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Queries
          </button>
          <button
            onClick={() => setFilterCategory('mutation')}
            className={`px-2 py-1 text-xs rounded ${
              filterCategory === 'mutation'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Mutations
          </button>
          <button
            onClick={() => setFilterCategory('subscription')}
            className={`px-2 py-1 text-xs rounded ${
              filterCategory === 'subscription'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Subscriptions
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* Queries */}
          {(filterCategory === 'all' || filterCategory === 'query') && queries.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-blue-400 uppercase">
                  Queries
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {filteredQueries.length}
                </Badge>
              </div>
              {filteredQueries.length === 0 ? (
                <p className="text-xs text-gray-500 ml-2">No matching queries</p>
              ) : (
                <div className="space-y-1">
                  {filteredQueries.map((field) => (
                    <OperationField key={field.name} field={field} typeName="Query" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mutations */}
          {(filterCategory === 'all' || filterCategory === 'mutation') && mutations.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-green-400 uppercase">
                  Mutations
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {filteredMutations.length}
                </Badge>
              </div>
              {filteredMutations.length === 0 ? (
                <p className="text-xs text-gray-500 ml-2">No matching mutations</p>
              ) : (
                <div className="space-y-1">
                  {filteredMutations.map((field) => (
                    <OperationField key={field.name} field={field} typeName="Mutation" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subscriptions */}
          {(filterCategory === 'all' || filterCategory === 'subscription') && subscriptions.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-purple-400 uppercase">
                  Subscriptions
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {filteredSubscriptions.length}
                </Badge>
              </div>
              {filteredSubscriptions.length === 0 ? (
                <p className="text-xs text-gray-500 ml-2">No matching subscriptions</p>
              ) : (
                <div className="space-y-1">
                  {filteredSubscriptions.map((field) => (
                    <OperationField key={field.name} field={field} typeName="Subscription" />
                  ))}
                </div>
              )}
            </div>
          )}

          {queries.length === 0 && mutations.length === 0 && subscriptions.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-sm">No operations found in schema</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

