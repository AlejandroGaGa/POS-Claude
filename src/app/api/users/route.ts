import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { User } from "@/lib/models/User";
import { UserCreate, parse } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  await requireApi("users:manage");
  const data = parse(UserCreate, await req.json());
  await connectDB();
  const u = await User.create({ name: data.name, username: data.username, role: data.role, passwordHash: await bcrypt.hash(data.password, 10) });
  return NextResponse.json({ id: String(u._id) }, { status: 201 });
});
