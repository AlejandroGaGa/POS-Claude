import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { HttpError, handle, requireApi } from "@/lib/auth";
import { BillingProfile } from "@/lib/models/BillingProfile";
import { Customer } from "@/lib/models/Customer";
import { BillingInput, parse } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, "No encontrado.");
  const b = await BillingProfile.findById(id);
  if (!b) throw new HttpError(404, "No encontrado.");
  return b;
}

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  await requireApi("customers:manage");
  const { customerId, ...data } = parse(BillingInput, await req.json());
  await connectDB();
  const b = await load((await params).id);
  if (!Types.ObjectId.isValid(customerId)) throw new HttpError(400, "Cliente inválido.");
  const c = await Customer.findById(customerId).select("name").lean();
  if (!c) throw new HttpError(400, "El cliente no existe.");
  Object.assign(b, data, { customer: c._id, customerName: c.name });
  await b.save();
  return NextResponse.json({ profile: b });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await requireApi("customers:manage");
  await connectDB();
  const b = await load((await params).id);
  await b.deleteOne();
  return NextResponse.json({ ok: true });
});
