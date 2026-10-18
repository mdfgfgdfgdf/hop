import { hash, verify } from "@node-rs/argon2";

const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password, OPTIONS);
  } catch {
    return false;
  }
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "הסיסמה חייבת להכיל לפחות 8 תווים";
  if (!/[0-9]/.test(password)) return "הסיסמה חייבת להכיל לפחות ספרה אחת";
  if (!/[a-zA-Z֐-׿]/.test(password)) return "הסיסמה חייבת להכיל אותיות";
  return null;
}
