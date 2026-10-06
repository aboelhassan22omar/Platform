import { randomBytes, createHash, randomUUID } from 'node:crypto';

/**
 * Human-friendly order reference shown to students and support staff,
 * e.g. `AM-7QK2-4F9X`. Deliberately avoids characters that are easy to confuse
 * when read aloud over the phone (0/O, 1/I/L).
 */
const READABLE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export const generateOrderReference = (): string => {
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += READABLE_ALPHABET[bytes[i] % READABLE_ALPHABET.length];
    if (i === 3) out += '-';
  }
  return `AM-${out}`;
};

/** Cryptographically random opaque token (refresh tokens, playback tickets). */
export const generateToken = (bytes = 48): string => randomBytes(bytes).toString('base64url');

/**
 * Tokens are stored hashed so a database leak does not hand out live sessions.
 * SHA-256 is correct here (not Argon2): the input is already high-entropy
 * random, so there is nothing to brute-force and lookups must stay fast.
 */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const newIdempotencyKey = (): string => randomUUID();
