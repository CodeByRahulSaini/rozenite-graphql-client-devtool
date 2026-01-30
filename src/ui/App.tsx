import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { pluginId } from '../shared/constants'; 
 

export default function ApolloDevToolsPanel() {
 
  const client = useRozeniteDevToolsClient({
    pluginId: pluginId
  });
 
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}> 
    </div>
  );
}
