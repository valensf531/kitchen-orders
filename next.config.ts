import type { NextConfig } from "next";

/* CSP pragmático para Next App Router sin nonces: bloquea scripts/objetos
   externos, marcos y formularios cruzados. En dev se suma 'unsafe-eval' y
   ws:/wss: para el HMR de Turbopack. Las fotos/QR (data:, blob:,
   api.qrserver.com) quedan permitidas solo como imagen. */
function contentSecurityPolicy(isDev: boolean): string {
  const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
  const connectSrc = isDev ? "'self' ws: wss:" : "'self'";
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://api.qrserver.com",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  /* Build mínimo autocontenido para la imagen Docker (un cliente = un contenedor). */
  output: 'standalone',
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },
        ],
      },
    ];
  },
};

export default nextConfig;
