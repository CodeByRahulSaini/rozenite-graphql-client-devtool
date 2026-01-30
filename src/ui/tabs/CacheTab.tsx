import { useState, useEffect } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { useCacheEntries, useActions } from '../store/hooks';
import { ScrollArea } from '../components/ScrollArea';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { JsonTree } from '../components/JsonTree';
import { Badge } from '../components/Badge';
import { CacheEntry } from '../../shared/types';

export function CacheTab() {
  const cacheEntries = useCacheEntries();
  const { requestCacheSnapshot } = useActions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<CacheEntry | null>(null);
  const [groupByType, setGroupByType] = useState(true);

  useEffect(() => {
    // Request initial cache snapshot when tab is mounted
    requestCacheSnapshot();
  }, [requestCacheSnapshot]);

  // Convert cache entries Map to array and apply filters
  const entriesArray = Array.from(cacheEntries.values());
  const filteredEntries = entriesArray.filter((entry) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      entry.key.toLowerCase().includes(searchLower) ||
      (entry.typename && entry.typename.toLowerCase().includes(searchLower))
    );
  });

  // Group entries by typename if enabled
  const groupedEntries = groupByType
    ? filteredEntries.reduce((acc, entry) => {
        const typename = entry.typename || 'Unknown';
        if (!acc[typename]) {
          acc[typename] = [];
        }
        acc[typename].push(entry);
        return acc;
      }, {} as Record<string, CacheEntry[]>)
    : { All: filteredEntries };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search cache entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-sm bg-gray-700 border-gray-600"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={groupByType}
            onChange={(e) => setGroupByType(e.target.checked)}
            className="rounded"
          />
          Group by Type
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={requestCacheSnapshot}
          className="h-8"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
        <span className="text-xs text-gray-400">
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Cache Entries List */}
        <div
          className={`flex flex-col ${
            selectedEntry ? 'w-1/2' : 'w-full'
          } border-r border-gray-700 overflow-hidden`}
        >
          {entriesArray.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">💾</div>
                <p className="text-sm">No cache entries</p>
                <p className="text-xs mt-1">Cache data will appear here</p>
              </div>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">🔍</div>
                <p className="text-sm">No matching entries</p>
                <p className="text-xs mt-1">Try adjusting your search</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-2">
                {Object.entries(groupedEntries).map(([typename, entries]) => (
                  <div key={typename} className="mb-4">
                    {groupByType && (
                      <div className="flex items-center gap-2 mb-2 px-2">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase">
                          {typename}
                        </h3>
                        <Badge variant="secondary" className="text-xs">
                          {entries.length}
                        </Badge>
                      </div>
                    )}
                    <div className="space-y-1">
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`p-2 rounded cursor-pointer hover:bg-gray-800 transition-colors ${
                            selectedEntry?.id === entry.id
                              ? 'bg-gray-800 border-l-2 border-blue-500'
                              : ''
                          }`}
                          onClick={() => setSelectedEntry(entry)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-200 font-mono truncate">
                                {entry.key}
                              </p>
                              {entry.typename && !groupByType && (
                                <p className="text-xs text-gray-400 mt-1">
                                  {entry.typename}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Detail Panel */}
        {selectedEntry && (
          <div className="w-1/2 flex flex-col bg-gray-900">
            <div className="p-3 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-gray-200 font-mono break-all">
                {selectedEntry.key}
              </h3>
              {selectedEntry.typename && (
                <p className="text-xs text-gray-400 mt-1">
                  Type: {selectedEntry.typename}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Updated: {new Date(selectedEntry.timestamp).toLocaleString()}
              </p>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3">
                <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase">
                  Data
                </h4>
                <div className="bg-gray-800 p-3 rounded">
                  <JsonTree
                    data={selectedEntry.data}
                    shouldExpandNode={(keyPath, data, level) => level < 2}
                  />
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

