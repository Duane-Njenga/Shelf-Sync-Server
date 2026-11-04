import bcrypt from 'bcryptjs';

export async function createUser(trx, { fullName, email, phone, password, roleName }) {
  const role = await trx('roles').where({ role_name: roleName }).first();
  if (!role) throw new Error(`Role ${roleName} not found`);

  // Fetch the latest membership number to derive the next number safely
  const lastUser = await trx('users')
    .where('membership_no', 'like', 'MEM%')
    .orderBy('user_id', 'desc')
    .first();

  let nextNum = 1;
  if (lastUser && lastUser.membership_no) {
    const parsed = parseInt(lastUser.membership_no.replace('MEM', ''), 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  const membershipNo = `MEM${String(nextNum).padStart(3, '0')}`;
  const passwordHash = await bcrypt.hash(password, 10);

  const [userId] = await trx('users').insert({
    membership_no: membershipNo,
    full_name: fullName,
    email,
    phone,
    password_hash: passwordHash,
    role_id: role.role_id,
    status: 'Active'
  });

  return { id: userId, membershipNo, fullName, email, phone, role: roleName };
}