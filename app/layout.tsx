import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lockhart Surface Solutions',
  description: 'Professional asphalt maintenance estimator',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e40af',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* TEMPORARY diagnostic - remove once the production crash is
            identified. React error boundaries (app/error.tsx) only catch
            errors thrown during render; this crash may be happening
            asynchronously (e.g. inside a Google Maps script callback),
            which boundaries can't intercept and which Next.js's own
            fallback UI silently wipes the page for. alert() blocks and
            renders over whatever Next does to the DOM afterward, so the
            raw message is guaranteed visible - screenshot it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function (e) {
                alert('JS ERROR: ' + (e.message || '') + '\\n' + (e.error && e.error.stack ? String(e.error.stack).slice(0, 600) : ''));
              });
              window.addEventListener('unhandledrejection', function (e) {
                var reason = e.reason;
                var msg = reason && reason.message ? reason.message : String(reason);
                var stack = reason && reason.stack ? String(reason.stack).slice(0, 600) : '';
                alert('PROMISE REJECTION: ' + msg + '\\n' + stack);
              });
            `,
          }}
        />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
