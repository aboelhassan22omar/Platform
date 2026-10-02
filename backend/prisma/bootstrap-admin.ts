/**
 * Secure first-administrator bootstrap.
 *
 * Run ONCE to create the initial admin:
 *
 *   BOOTSTRAP_ADMIN_USERNAME=... BOOTSTRAP_ADMIN_PASSWORD=... \
 *   BOOTSTRAP_ADMIN_FULLNAME=... BOOTSTRAP_ADMIN_PHONE=... \
 *   npm run bootstrap:admin
 *
 * Safeguards:
 *   - refuses to run if ANY admin already exists (no privilege escalation
 *     by re-running it)
 *   - refuses weak passwords
 *   - credentials come from the environment, never from committed files
 *   - the action is written to the audit log
 *
 * There is deliberately no self-service admin registration endpoint.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hash } from '@node-rs/argon2';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const normalizePhone = (raw: string): string | null => {
  let v = raw.trim().replace(/[\s\-().]/g, '');
  if (v.startsWith('+20')) v = `0${v.slice(3)}`;
  else if (v.startsWith('0020')) v = `0${v.slice(4)}`;
  else if (v.length === 10 && v.startsWith('1')) v = `0${v}`;
  return /^(010|011|012|015)\d{8}$/.test(v) ? v : null;
};

async function main() {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const fullName = process.env.BOOTSTRAP_ADMIN_FULLNAME?.trim();
  const rawPhone = process.env.BOOTSTRAP_ADMIN_PHONE?.trim();

  const missing = [
    !username && 'BOOTSTRAP_ADMIN_USERNAME',
    !password && 'BOOTSTRAP_ADMIN_PASSWORD',
    !fullName && 'BOOTSTRAP_ADMIN_FULLNAME',
    !rawPhone && 'BOOTSTRAP_ADMIN_PHONE',
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Missing required variables: ${missing.join(', ')}`);
  }

  if (password!.length < 6) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 6 characters.');
  }

  const phone = normalizePhone(rawPhone!);
  if (!phone) throw new Error('BOOTSTRAP_ADMIN_PHONE is not a valid Egyptian mobile number.');

  const existingAdmin = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: { username: true },
  });

  if (existingAdmin) {
    console.log(
      `[bootstrap] An administrator already exists ("${existingAdmin.username}"). Nothing to do.`,
    );
    console.log('[bootstrap] Create further staff accounts from the dashboard.');
    return;
  }

  const clash = await prisma.user.findFirst({
    where: { OR: [{ username }, { phone }] },
    select: { id: true },
  });
  if (clash) throw new Error('That username or phone number is already registered.');

  const passwordHash = await hash(password!, {
    algorithm: 2, // Argon2id; avoids consuming the dependency's ambient const enum.
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const admin = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username: username!,
        fullName: fullName!,
        passwordHash,
        phone,
        parentPhone: phone,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'admin.bootstrap',
        entityType: 'User',
        entityId: user.id,
        targetUserId: user.id,
        metadata: { username: user.username, role: user.role },
      },
    });

    return user;
  });

  console.log(`[bootstrap] Created SUPER_ADMIN "${admin.username}".`);
  console.log('[bootstrap] Remove the BOOTSTRAP_ADMIN_* values from your .env now.');
}

main()
  .catch((error) => {
    console.error(`[bootstrap] ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
