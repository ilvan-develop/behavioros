export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-4xl font-bold">404</h2>
        <p className="mt-4 text-zinc-400">Page not found</p>
        <a href="/" className="mt-4 inline-block text-purple-400 hover:text-purple-300">
          Go home
        </a>
      </div>
    </div>
  );
}
