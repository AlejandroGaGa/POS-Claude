import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { HttpError, handle, requireApi } from "@/lib/auth";
import { ROLE_LABELS, canManageRole } from "@/lib/roles";
import { User } from "@/lib/models/User";
import { UserCreate, parse } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const me = await requireApi("users:manage");
  const data = parse(UserCreate, await req.json());
  if (!canManageRole(me.role, data.role)) throw new HttpError(403, `No tienes permiso para crear usuarios con el rol «${ROLE_LABELS[data.role]}».`);
  await connectDB();
  const u = await User.create({ name: data.name, username: data.username, role: data.role, passwordHash: await bcrypt.hash(data.password, 10) });
  return NextResponse.json({ id: String(u._id) }, { status: 201 });
});
