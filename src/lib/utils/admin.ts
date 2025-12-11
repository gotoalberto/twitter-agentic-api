export function isAdmin(username: string): boolean {
  console.log('🔍 isAdmin() called with username:', username);

  const rawEnvVar = process.env.ALLOWED_ADMIN_USERS;
  console.log('🔍 Raw ALLOWED_ADMIN_USERS env var:', rawEnvVar);

  const allowedUsers = rawEnvVar?.split(',') || [];
  console.log('🔍 Allowed users array (after split):', allowedUsers);

  const allowedUsersLower = allowedUsers.map(u => u.trim().toLowerCase());
  console.log('🔍 Allowed users (lowercase, trimmed):', allowedUsersLower);

  const usernameLower = username.toLowerCase();
  console.log('🔍 Username to check (lowercase):', usernameLower);

  const result = allowedUsersLower.includes(usernameLower);
  console.log('🔍 isAdmin result:', result);

  return result;
}

export function getAdminUsers(): string[] {
  return process.env.ALLOWED_ADMIN_USERS?.split(',') || [];
}
