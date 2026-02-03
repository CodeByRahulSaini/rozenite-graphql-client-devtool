export let useGraphqlClientDevtool: typeof import('./src/react-native/useGraphqlClientDevtool').useGraphqlClientDevtool;

const isWeb =
    typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
    useGraphqlClientDevtool =
        require('./src/react-native/useGraphqlClientDevtool').useGraphqlClientDevtool;
} else {
    useGraphqlClientDevtool = () => null as any;
}
