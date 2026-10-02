import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { handle } from "@/lib/auth";
import { parse } from "@/lib/validation";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "@/lib/session";
import { homeFor } from "@/lib/roles";

const Body = z.object({ username: z.string().trim().toLowerCase().min(1), password: z.string().min(1) });

export const POST = handle(async (req: Request) => {
  const { username, password } = parse(Body, await req.json());
  await connectDB();
  const user = await User.findOne({ username }).select("+passwordHash");
  const ok = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });

  const session = { id: String(user._id), name: user.name, username: user.username, role: user.role };
  const res = NextResponse.json({ ok: true, redirect: homeFor(user.role) });
  res.cookies.set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return res;
});
