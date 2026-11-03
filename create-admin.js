import readline from 'node:readline/promises';
import { db } from './src/db.js';
import { registerSchema } from './src/features/auth/auth.schemas.js';
import { createUser } from './src/features/auth/users.service.js';
import { audit } from './src/services/audit.js';

const FIELDS = [
  { key: 'fullName', env: 'ADMIN_NAME', label: 'Full name' },
  { key: 'email', env: 'ADMIN_EMAIL', label: 'Email' },
  { key: 'phone', env: 'ADMIN_PHONE', label: 'Phone (e.g. 0712345678)' },
  { key: 'password', env: 'ADMIN_PASSWORD', label: 'Password (at least 8 characters)' },
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function collect({ key, env, label }) {
  for (;;) {
    const fromEnv = process.env[env];
    const answer = fromEnv ?? (await rl.question(`${label}: `));
    const result = registerSchema.shape[key].safeParse(answer);
    if (result.success) return result.data;
    console.error(`  ${result.error.issues[0].message}`);
    if (fromEnv !== undefined) process.exit(1);
  }
}

try {
  const input = {};
  for (const field of FIELDS) input[field.key] = await collect(field);
  rl.close();

  const existing = await db('users').where({ email: input.email }).first('user_id');
  if (existing) {
    console.log(`A user with email ${input.email} already exists. Nothing to do.`);
  } else {
    const user = await db.transaction(async (trx) => {
      const created = await createUser(trx, { ...input, roleName: 'Admin' });
      await audit(trx, { userId: created.id, action: 'ADMIN_CREATED', table: 'users', recordId: created.id });
      return created;
    });
    console.log(`\nAdmin created. Log in with membership number ${user.membershipNo} or ${user.email}.`);
  }
} finally {
  rl.close();
  await db.destroy();
}
