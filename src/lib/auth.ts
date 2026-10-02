import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { connectDB } from "./db";
import { User } from "./models/User";
import { can, type Permission } from "./roles";
import { SESSION_COOKIE, verifySession, type SessionUser } from "./session";
import { HttpError } from "./errors";

/**
 * Lee la sesión de la cookie y confirma contra la base que el usuario sigue activo
 * y con el mismo rol (si el admin lo desactiva o le cambia el rol, aplica de inmediato).
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const s = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  await connectDB();
  const u = await User.findById(s.id).select("name username role active").lean();
  if (!u || !u.active) return null;
  return { id: String(u._id), name: u.name, username: u.username, role: u.role };
}

/** Para páginas (server components): redirige si no hay sesión o permiso. */
export async function requirePage(perm?: Permission): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (perm && !can(s.role, perm)) redirect("/sin-permiso");
  return s;
}

export { HttpError };

/** Para rutas de API: lanza HttpError si no hay sesión o permiso. */
export async function requireApi(perm?: Permission): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Tu sesión expiró. Vuelve a entrar.");
  if (perm && !can(s.role, perm)) throw new HttpError(403, "No tienes permiso para esta acción.");
  return s;
}

/** Envuelve un handler de API y convierte errores conocidos en JSON con su código. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if ((e as { name?: string })?.name === "PricingError") {
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
      }
      if ((e as { code?: number })?.code === 11000) {
        return NextResponse.json({ error: "Ya existe un registro con ese código o usuario." }, { status: 409 });
      }
      console.error(e);
      return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
    }
  };
}
