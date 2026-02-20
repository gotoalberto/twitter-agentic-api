export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          X Forwarder
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Twitter Webhook Management System
        </p>

        <div className="flex justify-center gap-4">
          <a
            href="/admin"
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition duration-200 shadow-md hover:shadow-lg"
          >
            Access Admin Panel →
          </a>
        </div>

        <div className="mt-12 text-gray-500 text-sm">
          <p>© 2024 X Forwarder. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
