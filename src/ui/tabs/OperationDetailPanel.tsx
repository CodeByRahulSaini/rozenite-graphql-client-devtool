import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import { ScrollArea } from '../components/ScrollArea';
import { JsonTree } from '../components/JsonTree';
import { GraphQLOperation } from '../../shared/types';

interface OperationDetailPanelProps {
  operation: GraphQLOperation;
}

export function OperationDetailPanel({ operation }: OperationDetailPanelProps) {
  return (
    <div className="w-1/2 flex flex-col bg-gray-900">
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">
          {operation.operationName || 'Unnamed Operation'}
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          {operation.operationType.toUpperCase()}
        </p>
      </div>

      <Tabs defaultValue="query" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2">
          <TabsTrigger value="query">Query</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="response">
            {operation.status === 'error' ? 'Error' : 'Response'}
          </TabsTrigger>
          <TabsTrigger value="timing">Timing</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="query" className="p-3">
            <pre className="text-xs text-gray-300 bg-gray-800 p-3 rounded overflow-x-auto">
              <code>{operation.query}</code>
            </pre>
          </TabsContent>

          <TabsContent value="variables" className="p-3">
            {operation.variables && Object.keys(operation.variables).length > 0 ? (
              <div className="bg-gray-800 p-3 rounded">
                <JsonTree
                  data={operation.variables}
                  shouldExpandNode={() => true}
                />
              </div>
            ) : (
              <div className="text-gray-400 text-sm text-center py-8">
                No variables
              </div>
            )}
          </TabsContent>

          <TabsContent value="response" className="p-3">
            {operation.status === 'error' && operation.error ? (
              <div className="bg-red-900/20 border border-red-800 rounded p-3">
                <h4 className="text-red-400 font-semibold text-sm mb-2">Error</h4>
                <p className="text-red-300 text-sm mb-3">{operation.error.message}</p>
                {operation.error.locations && (
                  <div className="text-xs text-red-400 mb-2">
                    <strong>Location:</strong>{' '}
                    {operation.error.locations.map((loc) => `Line ${loc.line}, Column ${loc.column}`).join('; ')}
                  </div>
                )}
                {operation.error.path && (
                  <div className="text-xs text-red-400 mb-2">
                    <strong>Path:</strong> {operation.error.path.join(' → ')}
                  </div>
                )}
                {operation.error.extensions && (
                  <div className="mt-3">
                    <h5 className="text-xs font-semibold text-red-400 mb-1">Extensions:</h5>
                    <JsonTree data={operation.error.extensions} />
                  </div>
                )}
              </div>
            ) : operation.data ? (
              <div className="bg-gray-800 p-3 rounded">
                <JsonTree
                  data={operation.data}
                  shouldExpandNode={(keyPath, data, level) => level < 2}
                />
              </div>
            ) : (
              <div className="text-gray-400 text-sm text-center py-8">
                {operation.status === 'loading' || operation.status === 'pending'
                  ? 'Loading...'
                  : 'No response data'}
              </div>
            )}
          </TabsContent>

          <TabsContent value="timing" className="p-3">
            <div className="bg-gray-800 p-3 rounded space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Status:</span>
                <span className="text-gray-200">{operation.status}</span>
              </div>
              {operation.duration !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Duration:</span>
                  <span className="text-gray-200">{operation.duration.toFixed(2)}ms</span>
                </div>
              )}
              <div className="text-xs text-gray-500 italic mt-2 mb-2">
                Note: Duration values are approximate and may not reflect exact operation timing.
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Timestamp:</span>
                <span className="text-gray-200">
                  {new Date(operation.timestamp).toLocaleString()}
                </span>
              </div>
              {operation.fromCache && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Source:</span>
                  <span className="text-yellow-400">Cache</span>
                </div>
              )}
              {operation.context && Object.keys(operation.context).length > 0 && (
                <div className="mt-3">
                  <h5 className="text-xs font-semibold text-gray-400 mb-2">Context:</h5>
                  <JsonTree data={operation.context} />
                </div>
              )}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

