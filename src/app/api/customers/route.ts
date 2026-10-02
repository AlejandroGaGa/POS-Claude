import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { HttpError, handle, requireApi } from "@/lib/auth";
import { Customer, phoneKey } from "@/lib/models/Customer";
import { can } from "@/lib/roles";
import { escapeRegex } from "@/lib/text";
import { parsePage } from "@/lib/paginate";
import { CustomerInput, parse } from "@/lib/validation";

/** Búsqueda paginada de clientes (nombre o teléfono). Usado por el buscador del mostrador. */
export const GET = handle(async (req: Request) => {
  await requireApi("customers:manage");
  await connectDB();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const page = parsePage(url.searchParams.get("pagina"));
  const size = Math.min(50, Number(url.searchParams.get("limite")) || 10);
  const filter: Record<string, unknown> = { active: true };
  if (q) {
    const digits = q.replace(/\D/g, "");
    const or: Record<string, unknown>[] = [{ name: new RegExp(escapeRegex(q), "i") }];
    if (digits.length >= 3) or.push({ phoneKey: new RegExp(escapeRegex(digits)) });
    filter.$or = or;
  }
  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip((page - 1) * size).limit(size).select("name phone customerType preferential creditLimit").lean(),
    Customer.countDocuments(filter),
  ]);
  return NextResponse.json({ customers, total, page, pages: Math.max(1, Math.ceil(total / size)) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireApi("customers:manage");
  const data = parse(CustomerInput, await req.json());
  if ((data.preferential || data.creditLimit) && !can(user.role, "customers:credit")) throw new HttpError(403, "Solo el encargado o el administrador autorizan clientes preferenciales.");
  await connectDB();
  const key = phoneKey(data.phone);
  if (key.length >= 7 && (await Customer.exists({ phoneKey: key, active: true }))) throw new HttpError(409, "Ya hay un cliente con ese teléfono.");
  const c = await Customer.create({ ...data, phoneKey: key });
  return NextResponse.json({ customer: c }, { status: 201 });
});
