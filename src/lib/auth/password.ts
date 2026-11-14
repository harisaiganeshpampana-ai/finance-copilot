// SERVER-ONLY. Password hashing with bcryptjs.

import bcrypt from "bcryptjs";

export const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Used when no user matches, so a failed login takes about as long whether or not
// the email exists (makes it harder to discover which emails have accounts).
const DUMMY_HASH = bcrypt.hashSync("calmowe-timing-guard", BCRYPT_ROUNDS);
export async function burnPasswordCheck(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH);
}
