export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[#fafafa]">404</h1>
        <p className="mt-4 text-lg text-[#a1a1aa]">Page not found</p>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg bg-[#0A7C4F] px-6 py-3 text-sm font-medium text-white hover:bg-[#0A7C4F]/90"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
