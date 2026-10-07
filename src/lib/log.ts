/* Logueo consistente de errores del servidor para poder diagnosticar. */
export function logError(scope: string, error: unknown) {
  console.error(`[${scope}]`, error);
}
