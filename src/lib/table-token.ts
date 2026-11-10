import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TableTokenInput {
  restaurantId: string;
  tableId: string;
  tableNumber: number;
  zone: string;
}

type TableTokenPayload = {
  v: 1;
  r: string;
  t: string;
  n: number;
  z: string;
};

function signingSecret(): string {
  const secret = process.env.PUBLIC_ORDER_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('Falta PUBLIC_ORDER_SECRET o BETTER_AUTH_SECRET para firmar QRs');
  }
  return secret;
}

function hmac(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload).digest('base64url');
}

/*
 * Token firmado que viaja en el QR de cada mesa. No reemplaza la sesión:
 * evita que alguien invente un pedido a una mesa sin haber escaneado su QR.
 * Es estático (el QR se imprime), así que no expira; se puede rotar cambiando
 * PUBLIC_ORDER_SECRET y reimprimiendo.
 */
export function signTableToken(input: TableTokenInput): string {
  const payload: TableTokenPayload = {
    v: 1,
    r: input.restaurantId,
    t: input.tableId,
    n: input.tableNumber,
    z: input.zone,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${hmac(encoded)}`;
}

export function verifyTableToken(token: unknown, expected: TableTokenInput): boolean {
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return false;
  }
  const separator = token.lastIndexOf('.');
  if (separator <= 0 || separator === token.length - 1) return false;

  const encoded = token.slice(0, separator);
  const received = token.slice(separator + 1);
  const expectedSignature = hmac(encoded);
  const receivedBuffer = Buffer.from(received, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  if (!timingSafeEqual(receivedBuffer, expectedBuffer)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<TableTokenPayload>;
    return (
      payload.v === 1 &&
      payload.r === expected.restaurantId &&
      payload.t === expected.tableId &&
      payload.n === expected.tableNumber &&
      payload.z === expected.zone
    );
  } catch {
    return false;
  }
}
