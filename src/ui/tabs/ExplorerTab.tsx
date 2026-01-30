import { useState, useEffect } from 'react';
import { Search, Copy, Check } from 'lucide-react';
import { useSchema, useActions } from '../store/hooks';
import { ScrollArea } from '../components/ScrollArea';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { GraphQLField, GraphQLType } from '../../shared/types';

export function ExplorerTab() {
  const schema = useSchema();
  const { requestSchema } = useActions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'query' | 'mutation' | 'subscription'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<{
    field: GraphQLField;
    operationType: string;
  } | null>(null);
  const [expansionDepth, setExpansionDepth] = useState<number>(15);
  const [responseFormat, setResponseFormat] = useState<'schema' | 'query'>('schema');

  useEffect(() => {
    // Request schema when tab is mounted
    requestSchema();
  }, [requestSchema]);

  const handleCopy = async (text: string, id: string) => {
    try {
      if (!text) {
        console.error('Cannot copy empty text');
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers or when clipboard API is not available
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy also failed:', fallbackErr);
      }
    }
  };

  // Extract type name from GraphQL type string (removes !, [], etc.)
  const extractTypeName = (typeStr: string): string => {
    return typeStr.replace(/[[\]!]/g, '');
  };

  // Find type definition in schema
  const findType = (typeName: string): GraphQLType | null => {
    if (!schema) return null;
    return schema.types.find(t => t.name === typeName) || null;
  };

  // Expand type recursively to show full structure
  const expandType = (typeStr: string, depth = 0, visited: Set<string> = new Set(), maxDepth = 15): string => {
    const indent = '  '.repeat(depth);
    
    // Preserve original type markers (array brackets, required !)
    const isArray = typeStr.includes('[');
    const isRequired = typeStr.endsWith('!');
    const typeName = extractTypeName(typeStr);
    
    // Handle built-in scalar types first
    const scalars = ['String', 'Int', 'Float', 'Boolean', 'ID'];
    if (scalars.includes(typeName)) {
      return typeStr;
    }
    
    const type = findType(typeName);
    if (!type) {
      // Type not found in schema - return with comment
      console.warn(`[Explorer] Type "${typeName}" not found in schema`);
      return `${typeStr} /* type not in schema */`;
    }
    
    // Handle different type kinds
    if (type.kind === 'SCALAR') {
      return typeStr;
    }
    
    if (type.kind === 'ENUM') {
      const values = type.enumValues?.slice(0, 10).join(' | ') || '';
      const more = type.enumValues && type.enumValues.length > 10 ? ` ... +${type.enumValues.length - 10} more` : '';
      return `${values}${more}`;
    }
    
    if (type.kind === 'OBJECT' || type.kind === 'INPUT_OBJECT' || type.kind === 'INTERFACE') {
      const fields = type.fields || [];
      if (fields.length === 0) {
        // Type has no fields - return as-is
        return typeStr;
      }
      
      // Check if we've hit max depth
      if (depth >= maxDepth) {
        return typeName;
      }
      
      // Check for circular reference in the direct ancestor chain
      const isCircular = visited.has(typeName);
      
      // If we've seen this type in the ancestor chain, just show the type name with markers
      // This prevents infinite recursion for truly circular references
      if (isCircular) {
        let result = typeName;
        if (isArray) {
          result = `[${result}]`;
        }
        if (isRequired) {
          result = `${result}!`;
        }
        return result;
      }
      
      // Add to visited set before recursing
      const newVisited = new Set(visited);
      newVisited.add(typeName);
      
      // Expand all fields
      const fieldStrings = fields.slice(0, 50).map(f => {
        const expandedFieldType = expandType(f.type, depth + 1, newVisited, maxDepth);
        return `${indent}  ${f.name}: ${expandedFieldType}`;
      });
      
      if (fields.length > 50) {
        fieldStrings.push(`${indent}  ... +${fields.length - 50} more fields`);
      }
      
      let result = `{\n${fieldStrings.join('\n')}\n${indent}}`;
      
      if (isArray) {
        result = `[${result}]`;
      }
      if (isRequired) {
        result = `${result}!`;
      }
      
      return result;
    }
    
    return typeStr;
  };

  // Generate expanded input signature
  const generateExpandedInputSignature = (field: GraphQLField): string => {
    if (!field.args || field.args.length === 0) {
      return '// No arguments required';
    }
    
    const args = field.args.map(arg => {
      const expandedType = expandType(arg.type, 0, new Set(), expansionDepth);
      const defaultVal = arg.defaultValue ? ` = ${arg.defaultValue}` : '';
      
      // If the expanded type is multi-line, indent it properly
      if (expandedType.includes('\n')) {
        const indentedType = expandedType.split('\n').map((line, idx) => {
          if (idx === 0) return line; // First line stays at arg name level
          return `  ${line}`; // Indent subsequent lines
        }).join('\n');
        return `  ${arg.name}: ${indentedType}${defaultVal}`;
      }
      
      return `  ${arg.name}: ${expandedType}${defaultVal}`;
    });
    
    return `{\n${args.join('\n')}\n}`;
  };

  // Generate expanded output signature
  const generateExpandedOutputSignature = (field: GraphQLField): string => {
    return expandType(field.type, 0, new Set(), expansionDepth);
  };

  // Generate query format (for copy-pasting into GraphQL queries)
  const generateQueryFormat = (field: GraphQLField): string => {
    const formatType = (typeStr: string, depth = 0, visited: Set<string> = new Set()): string => {
      const indent = '  '.repeat(depth);
      const typeName = extractTypeName(typeStr);
      
      // Handle built-in scalar types
      const scalars = ['String', 'Int', 'Float', 'Boolean', 'ID'];
      if (scalars.includes(typeName)) {
        return ''; // Scalars don't need to be expanded in queries
      }
      
      // Prevent infinite recursion
      if (visited.has(typeName)) {
        return '';
      }
      
      const type = findType(typeName);
      if (!type || type.kind === 'SCALAR' || type.kind === 'ENUM') {
        return '';
      }
      
      if (type.kind === 'OBJECT' || type.kind === 'INPUT_OBJECT' || type.kind === 'INTERFACE') {
        const fields = type.fields || [];
        if (fields.length === 0) return '';
        
        // Limit depth for query format
        if (depth >= 4) return '';
        
        const newVisited = new Set(visited);
        newVisited.add(typeName);
        
        const fieldStrings = fields.slice(0, 30).map(f => {
          const fieldTypeName = extractTypeName(f.type);
          const fieldType = findType(fieldTypeName);
          const isScalarOrEnum = !fieldType || fieldType.kind === 'SCALAR' || fieldType.kind === 'ENUM';
          
          if (isScalarOrEnum) {
            return `${indent}  ${f.name}`;
          } else {
            const nested = formatType(f.type, depth + 1, newVisited);
            return nested ? `${indent}  ${f.name} ${nested}` : `${indent}  ${f.name}`;
          }
        });
        
        if (fields.length > 30) {
          fieldStrings.push(`${indent}  # ... +${fields.length - 30} more fields`);
        }
        
        return `{\n${fieldStrings.join('\n')}\n${indent}}`;
      }
      
      return '';
    };
    
    const queryFields = formatType(field.type);
    return queryFields || field.type;
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

  const CopyButton = ({ text, id, label }: { text: string; id: string; label?: string }) => {
    const isCopied = copiedId === id;
    
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleCopy(text, id);
        }}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 transition-colors"
        title={`Copy ${label || 'to clipboard'}`}
      >
        {isCopied ? (
          <>
            <Check className="h-3 w-3 text-green-400" />
            <span className="text-green-400">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            <span>{label || 'Copy'}</span>
          </>
        )}
      </button>
    );
  };

  // Simple list item component
  const OperationListItem = ({ 
    field, 
    operationType 
  }: { 
    field: GraphQLField; 
    operationType: string;
  }) => {
    const isSelected = selectedOperation?.field.name === field.name && 
                       selectedOperation?.operationType === operationType;
    
    const colorClass = operationType === 'Query' 
      ? 'text-blue-400' 
      : operationType === 'Mutation' 
      ? 'text-green-400' 
      : 'text-purple-400';
    
    return (
      <div
        onClick={() => setSelectedOperation({ field, operationType })}
        className={`p-2 rounded cursor-pointer transition-colors ${
          isSelected 
            ? 'bg-blue-600 text-white' 
            : 'hover:bg-gray-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-mono ${isSelected ? 'text-white' : colorClass}`}>
            {field.name}
          </span>
          {field.isDeprecated && (
            <Badge variant="warning" className="text-xs">
              ⚠️
            </Badge>
          )}
        </div>
        {field.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-1">
            {field.description}
          </p>
        )}
      </div>
    );
  };

  // Detail view component
  const OperationDetailView = ({ 
    field, 
    operationType 
  }: { 
    field: GraphQLField; 
    operationType: string;
  }) => {
    const inputSignature = generateExpandedInputSignature(field);
    const outputSignature = generateExpandedOutputSignature(field);
    const queryFormat = generateQueryFormat(field);
    
    const colorClass = operationType === 'Query' 
      ? 'text-blue-400' 
      : operationType === 'Mutation' 
      ? 'text-green-400' 
      : 'text-purple-400';
    
    return (
      <div className="p-4">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs uppercase">
                {operationType}
              </Badge>
              <h2 className={`text-xl font-mono font-semibold ${colorClass}`}>
                {field.name}
              </h2>
              {field.isDeprecated && (
                <Badge variant="warning" className="text-xs">
                  Deprecated
                </Badge>
              )}
            </div>
            
            {/* Expansion Depth Control */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Depth:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpansionDepth(Math.max(1, expansionDepth - 1))}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  title="Decrease expansion depth"
                >
                  −
                </button>
                <span className="px-3 py-1 bg-gray-800 rounded font-mono">
                  {expansionDepth}
                </span>
                <button
                  onClick={() => setExpansionDepth(Math.min(20, expansionDepth + 1))}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  title="Increase expansion depth"
                >
                  +
                </button>
                <button
                  onClick={() => setExpansionDepth(99)}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded transition-colors ml-1"
                  title="Expand all levels"
                >
                  ∞
                </button>
              </div>
            </div>
          </div>
          
          {field.description && (
            <p className="text-sm text-gray-300 leading-relaxed">
              {field.description}
            </p>
          )}
          
          {field.deprecationReason && (
            <div className="mt-2 p-3 bg-yellow-900/20 rounded border border-yellow-700/30">
              <p className="text-sm text-yellow-400">
                ⚠️ <strong>Deprecated:</strong> {field.deprecationReason}
              </p>
            </div>
          )}
        </div>

        {/* Input Type Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide">
                Input Type
              </h3>
              {field.args && field.args.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {field.args.length} {field.args.length === 1 ? 'argument' : 'arguments'}
                </Badge>
              )}
            </div>
            {field.args && field.args.length > 0 && (
              <CopyButton 
                text={inputSignature} 
                id={`${field.name}-input`}
                label="Copy"
              />
            )}
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <pre className="text-sm font-mono text-purple-300 whitespace-pre overflow-x-auto">
              {inputSignature}
            </pre>
          </div>
          
          {/* Argument details */}
          {field.args && field.args.length > 0 && (
            <div className="mt-3 space-y-2">
              {field.args.map((arg) => (
                <div 
                  key={arg.name} 
                  className="p-3 bg-gray-800 rounded border border-gray-700"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono text-purple-400 font-semibold">
                      {arg.name}
                    </span>
                    <span className="text-xs text-gray-500">:</span>
                    <span className="text-sm font-mono text-gray-300">
                      {arg.type}
                    </span>
                    {arg.defaultValue && (
                      <Badge variant="secondary" className="text-xs">
                        default: {arg.defaultValue}
                      </Badge>
                    )}
                  </div>
                  {arg.description && (
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {arg.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Output Type Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wide">
                Response Type
              </h3>
              <Badge variant="secondary" className="text-xs font-mono">
                {field.type}
              </Badge>
              {/* Format Toggle */}
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => setResponseFormat('schema')}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    responseFormat === 'schema'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Schema
                </button>
                <button
                  onClick={() => setResponseFormat('query')}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    responseFormat === 'query'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Query
                </button>
              </div>
            </div>
            <CopyButton 
              text={responseFormat === 'schema' ? outputSignature : queryFormat} 
              id={`${field.name}-output-${responseFormat}`}
              label="Copy"
            />
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <pre className="text-sm font-mono text-green-300 whitespace-pre overflow-x-auto">
              {responseFormat === 'schema' ? outputSignature : queryFormat}
            </pre>
          </div>
          
          {/* Format hint */}
          <div className="mt-2 text-xs text-gray-400">
            {responseFormat === 'schema' 
              ? '💡 Showing field types and structure for understanding'
              : '💡 Ready to copy into your GraphQL query'
            }
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - Operations List */}
      <div className="w-80 flex flex-col border-r border-gray-700 bg-gray-900">
        {/* Toolbar */}
        <div className="p-2 border-b border-gray-700">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search operations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-sm bg-gray-800 border-gray-700"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterCategory('all')}
              className={`flex-1 px-2 py-1 text-xs rounded ${
                filterCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterCategory('query')}
              className={`flex-1 px-2 py-1 text-xs rounded ${
                filterCategory === 'query'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Queries
            </button>
            <button
              onClick={() => setFilterCategory('mutation')}
              className={`flex-1 px-2 py-1 text-xs rounded ${
                filterCategory === 'mutation'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Mutations
            </button>
            <button
              onClick={() => setFilterCategory('subscription')}
              className={`flex-1 px-2 py-1 text-xs rounded ${
                filterCategory === 'subscription'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Subs
            </button>
          </div>
        </div>

        {/* Operations List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Queries */}
            {(filterCategory === 'all' || filterCategory === 'query') && queries.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 px-2">
                  <h3 className="text-xs font-semibold text-blue-400 uppercase">
                    Queries
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {filteredQueries.length}
                  </Badge>
                </div>
                {filteredQueries.length === 0 ? (
                  <p className="text-xs text-gray-500 px-2">No matching queries</p>
                ) : (
                  <div className="space-y-1">
                    {filteredQueries.map((field) => (
                      <OperationListItem 
                        key={field.name} 
                        field={field} 
                        operationType="Query" 
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mutations */}
            {(filterCategory === 'all' || filterCategory === 'mutation') && mutations.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 px-2">
                  <h3 className="text-xs font-semibold text-green-400 uppercase">
                    Mutations
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {filteredMutations.length}
                  </Badge>
                </div>
                {filteredMutations.length === 0 ? (
                  <p className="text-xs text-gray-500 px-2">No matching mutations</p>
                ) : (
                  <div className="space-y-1">
                    {filteredMutations.map((field) => (
                      <OperationListItem 
                        key={field.name} 
                        field={field} 
                        operationType="Mutation" 
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subscriptions */}
            {(filterCategory === 'all' || filterCategory === 'subscription') && subscriptions.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 px-2">
                  <h3 className="text-xs font-semibold text-purple-400 uppercase">
                    Subscriptions
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {filteredSubscriptions.length}
                  </Badge>
                </div>
                {filteredSubscriptions.length === 0 ? (
                  <p className="text-xs text-gray-500 px-2">No matching subscriptions</p>
                ) : (
                  <div className="space-y-1">
                    {filteredSubscriptions.map((field) => (
                      <OperationListItem 
                        key={field.name} 
                        field={field} 
                        operationType="Subscription" 
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {queries.length === 0 && mutations.length === 0 && subscriptions.length === 0 && (
              <div className="flex items-center justify-center p-8 text-gray-400">
                <div className="text-center">
                  <div className="text-3xl mb-2">📭</div>
                  <p className="text-xs">No operations</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Detail View */}
      <div className="flex-1 flex flex-col bg-gray-900">
        {selectedOperation ? (
          <ScrollArea className="flex-1">
            <OperationDetailView 
              field={selectedOperation.field} 
              operationType={selectedOperation.operationType} 
            />
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-5xl mb-3">👈</div>
              <p className="text-sm font-medium">Select an operation</p>
              <p className="text-xs text-gray-500 mt-1">
                Click on any operation from the list to view details
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

