import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { Settings } from "@/lib/models/Settings";
import { SettingsInput, parse } from "@/lib/validation";

export const PUT = handle(async (req: Request) => {
  await requireApi("settings:edit");
  const data = parse(SettingsInput, await req.json());
  await connectDB();
  await Settings.findByIdAndUpdate("global", data, { upsert: true });
  return NextResponse.json({ ok: true });
});
