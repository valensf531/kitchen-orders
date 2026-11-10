/* Logueo estructurado (JSON por línea) para que Dokploy/el hosting pueda
   filtrar y alertar. Si ALERT_WEBHOOK_URL está definido, cada error también
   se envía como POST (Discord, Slack o un endpoint propio). */
type LogLevel = 'error' | 'warn' | 'info';

type LogPayload = {
  level: LogLevel;
  scope: string;
  message: string;
  timestamp: string;
  error?: string;
  stack?: string;
  context?: unknown;
};

function describeError(error: unknown): { error: string; stack?: string } {
  if (error instanceof Error) {
    return { error: error.message, stack: error.stack };
  }
  if (typeof error === 'string') return { error };
  try {
    return { error: JSON.stringify(error) };
  } catch {
    return { error: String(error) };
  }
}

async function sendAlert(payload: LogPayload) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${payload.level}] ${payload.scope}: ${payload.message}`,
        payload,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* Una alerta caída no debe romper la request original. */
  }
}

function emit(level: LogLevel, scope: string, message: string, error?: unknown, context?: unknown) {
  const payload: LogPayload = {
    level,
    scope,
    message,
    timestamp: new Date().toISOString(),
    ...(error !== undefined ? describeError(error) : {}),
    ...(context !== undefined ? { context } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    void sendAlert(payload);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logError(scope: string, error: unknown, context?: unknown) {
  emit('error', scope, 'unhandled error', error, context);
}

export function logWarn(scope: string, message: string, context?: unknown) {
  emit('warn', scope, message, undefined, context);
}

export function logInfo(scope: string, message: string, context?: unknown) {
  emit('info', scope, message, undefined, context);
}
