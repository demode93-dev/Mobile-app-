'use client';

// Next.js App Router renders this in place of a crashed subtree instead of
// the generic "Application error: a client-side exception has occurred"
// page, so the real error message and stack are visible on-screen for
// debugging in the field (no browser dev tools needed).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 24, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#1e293b' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
        Something crashed
      </h1>
      <p style={{ marginBottom: 12 }}>{error.message}</p>
      {error.digest && <p style={{ marginBottom: 12, color: '#64748b' }}>Digest: {error.digest}</p>}
      <pre style={{ fontSize: 11, overflow: 'auto', background: '#f1f5f9', padding: 12, borderRadius: 8 }}>
        {error.stack}
      </pre>
      <button
        onClick={() => reset()}
        style={{ marginTop: 16, padding: '10px 20px', background: '#1e40af', color: '#fff', borderRadius: 8 }}
      >
        Try again
      </button>
    </div>
  );
}
