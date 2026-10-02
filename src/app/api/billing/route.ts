import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { HttpError, handle, requireApi } from "@/lib/auth";
import { BillingProfile } from "@/lib/models/BillingProfile";
import { Customer } from "@/lib/models/Customer";
import { BillingInput, parse } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  await requireApi("customers:manage");
  const { customerId, ...data } = parse(BillingInput, await req.json());
  if (!Types.ObjectId.isValid(customerId)) throw new HttpError(400, "Cliente inválido.");
  await connectDB();
  const c = await Customer.findById(customerId).select("name").lean();
  if (!c) throw new HttpError(400, "El cliente no existe.");
  if (await BillingProfile.exists({ customer: c._id, rfc: data.rfc })) throw new HttpError(409, "Ese RFC ya está registrado para este cliente.");
  const b = await BillingProfile.create({ ...data, customer: c._id, customerName: c.name });
  return NextResponse.json({ profile: b }, { status: 201 });
});
