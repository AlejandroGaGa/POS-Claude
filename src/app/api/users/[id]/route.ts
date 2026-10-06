import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { HttpError, handle, requireApi } from "@/lib/auth";
import { User } from "@/lib/models/User";
import { ROLE_LABELS, can, canManageRole } from "@/lib/roles";
import { UserUpdate, parse } from "@/lib/validation";

export const PUT = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireApi("users:manage");
  const id = (await params).id;
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, "Usuario no encontrado.");
  const data = parse(UserUpdate, await req.json());
  await connectDB();
  const u = await User.findById(id);
  if (!u) throw new HttpError(404, "Usuario no encontrado.");

  // Nadie administra cuentas con más permisos que los suyos (ni les cambia la contraseña), ni asigna un rol así.
  if (!canManageRole(me.role, u.role)) throw new HttpError(403, `No tienes permiso para modificar a un usuario con el rol «${ROLE_LABELS[u.role]}».`);
  if (data.role && !canManageRole(me.role, data.role)) throw new HttpError(403, `No tienes permiso para asignar el rol «${ROLE_LABELS[data.role]}».`);
  if (data.active === false && u.active && !can(me.role, "users:deactivate")) throw new HttpError(403, "Solo el administrador puede desactivar usuarios.");

  // Evita quedarse sin administradores activos.
  const losingAdmin = u.role === "admin" && ((data.role && data.role !== "admin") || data.active === false);
  if (losingAdmin) {
    const admins = await User.countDocuments({ role: "admin", active: true, _id: { $ne: u._id } });
    if (admins === 0) throw new HttpError(400, "Debe quedar al menos un administrador activo.");
  }
  if (id === me.id && data.active === false) throw new HttpError(400, "No puedes desactivar tu propio usuario.");

  if (data.name) u.name = data.name;
  if (data.role) u.role = data.role;
  if (typeof data.active === "boolean") u.active = data.active;
  if (data.password) u.passwordHash = await bcrypt.hash(data.password, 10);
  await u.save();
  return NextResponse.json({ ok: true });
});
