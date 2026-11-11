import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { getPool } from '@/lib/db';

type AuthInstance = ReturnType<typeof betterAuth>;

let _auth: AuthInstance | undefined;

export function getAuth(): AuthInstance {
  if (_auth) return _auth;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  /* Mismo pool que el resto de la app: evita duplicar conexiones. */
  const baseUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
  _auth = betterAuth({
    database: getPool(),
    emailAndPassword: {
      enabled: true,
      /* Registro público cerrado: los dueños los da de alta el SaaS
         (scripts/create-owner.mjs) y el personal lo crea cada admin desde
         Configuración. Así nadie se auto-crea restaurantes gratis. */
      disableSignUp: true,
    },
    user: {
      additionalFields: {
        /* Admin ve todo; staff opera sin estadísticas ni configuración.
           input:false: no se puede fijar desde el sign-up público. */
        role: {
          type: 'string',
          required: false,
          defaultValue: 'admin',
          input: false,
        },
        /* Id del dueño cuando la cuenta es personal vinculado.
           Null = la cuenta es dueña de sus propios datos. */
        ownerId: {
          type: 'string',
          required: false,
          defaultValue: null,
          input: false,
        },
      },
    },
    plugins: [nextCookies()],
    /* Orígenes extra por env (uno por cliente en Dokploy, separados por coma).
       better-auth ya confía en el origen de baseURL. En desarrollo Next puede
       arrancar en otro puerto (3000 ocupado) o abrirse como 127.0.0.1, y
       better-auth responde "Invalid origin"; cualquier puerto loopback sirve. */
    trustedOrigins: [
      ...(process.env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:*', 'http://127.0.0.1:*']),
      ...(process.env.ADDITIONAL_TRUSTED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ],
    baseURL: baseUrl,
  }) as unknown as AuthInstance;
  return _auth;
}

export type Session = ReturnType<typeof betterAuth>['$Infer']['Session'];
