import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing.
 *
 * Argon2id with parameters at the OWASP-recommended floor (19 MiB, t=2, p=1).
 * The memory cost is what makes GPU cracking expensive; do not lower it to
 * speed up tests — use fewer test users instead.
 */
@Injectable()
export class PasswordService {
  private readonly options = {
    algorithm: 2 as const, // Argon2id; avoids consuming the dependency's ambient const enum.
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  } as const;

  async hash(plain: string): Promise<string> {
    return hash(plain, this.options);
  }

  /**
   * Returns false rather than throwing on a malformed stored hash, so a
   * corrupt row cannot be distinguished from a wrong password by timing or
   * by error message.
   */
  async verify(storedHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(storedHash, plain, this.options);
    } catch {
      return false;
    }
  }
}
