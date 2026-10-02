// Firmado/verificación de la sesión. Solo usa `jose`, así que funciona en el middleware (edge).
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./roles";

export const SESSION_COOKIE = "hp_session";
export const SESSION_HOURS = 12;

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: Role;
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET falta o es muy corto (mínimo 16 caracteres)");
  return new TextEncoder().encode(s);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: String(payload.sub),
      name: String(payload.name),
      username: String(payload.username),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}
