import { useEffect } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { pluginId } from '../shared/constants';
import { GraphQLDevToolEventMap } from '../shared/events';
import { LoadingView } from './components/LoadingView';
import { Toolbar } from './components/Toolbar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/Tabs';
import { OperationsTab } from './tabs/OperationsTab';
import { CacheTab } from './tabs/CacheTab';
import { ExplorerTab } from './tabs/ExplorerTab';
import { useActions, useClientManagement, useIsRecording } from './store/hooks';
import './globals.css';

export default function GraphQLDevToolsPanel() {
  const client = useRozeniteDevToolsClient<GraphQLDevToolEventMap>({
    pluginId: pluginId,
  });

  const { setupClient, cleanupClient } = useClientManagement();
  const { setRecording, clearOperations } = useActions();
  const isRecording = useIsRecording();

  useEffect(() => {
    if (!client) {
      return;
    }

    setupClient(client);
    setRecording(true);

    return () => {
      setRecording(false);
      cleanupClient();
    };
  }, [client, setupClient, cleanupClient, setRecording]);

  if (!client) {
    return <LoadingView />;
  }

  const handleToggleRecording = () => {
    setRecording(!isRecording);
  };

  return (
    <div className="dark h-screen bg-gray-900 text-gray-100 flex flex-col">
      <Toolbar
        isRecording={isRecording}
        onToggleRecording={handleToggleRecording}
        onClear={clearOperations}
      />

      <Tabs defaultValue="operations" className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-gray-700 bg-gray-800 px-2">
          <TabsList className="bg-transparent">
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="cache">Cache</TabsTrigger>
            <TabsTrigger value="explorer">Explorer</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="operations" className="flex-1 min-h-0">
          <OperationsTab />
        </TabsContent>

        <TabsContent value="cache" className="flex-1 min-h-0">
          <CacheTab />
        </TabsContent>

        <TabsContent value="explorer" className="flex-1 min-h-0">
          <ExplorerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
