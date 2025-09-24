// React import not needed with new JSX transform

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="card p-8 max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Strøm Orchestration Platform
          </h1>
          <p className="text-gray-600 mb-6">
            React UI implementation with Vite, TypeScript, and TailwindCSS
          </p>
          <div className="flex gap-4">
            <button className="btn-primary">
              Primary Button
            </button>
            <button className="btn-secondary">
              Secondary Button
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
