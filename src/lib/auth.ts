import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { Pool } from '@neondatabase/serverless';

type AuthInstance = ReturnType<typeof betterAuth>;

let _pool: Pool | undefined;
let _auth: AuthInstance | undefined;

export function getAuth(): AuthInstance {
  if (_auth) return _auth;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  if (!_pool) {
    _pool = new Pool({
      connectionString,
    });
  }
  const baseUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
  _auth = betterAuth({
    database: _pool,
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
       better-auth ya confía en el origen de baseURL. */
    trustedOrigins: [
      'https://kitchen-orders-three.vercel.app',
      'http://localhost:3000',
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
