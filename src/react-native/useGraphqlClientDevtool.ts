import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { pluginId, } from '../shared/constants';


export const useGraphqlClientDevtool = () => {
    const pluginClient = useRozeniteDevToolsClient({
        pluginId: pluginId,
    });

}

