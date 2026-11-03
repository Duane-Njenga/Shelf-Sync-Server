import bcrypt from 'bcryptjs';

export async function createUser(trx, { fullName, email, phone, password, roleName }) {
  const role = await trx('roles').where({ role_name: roleName }).first();
  if (!role) throw new Error(`Role ${roleName} not found`);

  const userCount = await trx('users').count('user_id as count').first();
  const membershipNo = `MEM${String(Number(userCount.count) + 1).padStart(3, '0')}`;
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
