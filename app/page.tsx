export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">ContentMax</h1>
          <p className="text-gray-600 mt-2">
            AI-Powered Content Generation for E-commerce at Scale
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Site Taxonomy</h2>
            <p className="text-gray-600 text-sm mb-4">
              Visualize your entire site structure and content coverage
            </p>
            <button className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
              View Map
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Content Generation</h2>
            <p className="text-gray-600 text-sm mb-4">
              Generate optimized content for categories and brands
            </p>
            <button className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
              Start Generating
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Workflow Board</h2>
            <p className="text-gray-600 text-sm mb-4">
              Manage content through your editorial pipeline
            </p>
            <button className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
              Open Board
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4">Coverage Analytics</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">0</div>
              <div className="text-sm text-gray-600">Total Categories</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">0%</div>
              <div className="text-sm text-gray-600">Coverage</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">0</div>
              <div className="text-sm text-gray-600">Pending Review</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">0</div>
              <div className="text-sm text-gray-600">Published</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
