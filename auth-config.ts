// Obsoleto: configuración única en src/lib/auth.ts (incluye nextCookies + baseURL).
// Se mantiene por compatibilidad; no crear nuevas instancias aquí.
import { getAuth } from './src/lib/auth';

export const auth = getAuth();

export default auth;
