export function LoadingView() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-100">
      <div className="text-center">
        <div className="text-4xl mb-4">⚡</div>
        <h2 className="text-xl font-semibold mb-2">Connecting to GraphQL Client...</h2>
        <p className="text-gray-400 text-sm">
          Waiting for GraphQL devtool hook to initialize
        </p>
      </div>
    </div>
  );
}

