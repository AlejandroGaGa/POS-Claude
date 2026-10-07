import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { PriceLog } from "@/lib/models/PriceLog";
import { ProductInput, parse } from "@/lib/validation";
import { productSearchFilter } from "@/lib/productSearch";
import { parsePage } from "@/lib/paginate";

export const GET = handle(async (req: Request) => {
  await requireApi("products:view");
  await connectDB();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category") ?? "";
  const filter: Record<string, unknown> = { active: true };
  if (category) filter.category = category;
  // Sin exigir acentos, comillas, guiones ni × tal cual están en el catálogo.
  const search = productSearchFilter(q);
  if (search.length) filter.$and = search;
  // Paginación con MongoDB: ?pagina=N (60 por página) + total para "Cargar más".
  const size = 60;
  const page = parsePage(url.searchParams.get("pagina"));
  const [products, total] = await Promise.all([
    Product.find(filter).sort({ category: 1, group: 1, name: 1 }).skip((page - 1) * size).limit(size).lean(),
    Product.countDocuments(filter),
  ]);
  return NextResponse.json({ products, total, page, pages: Math.max(1, Math.ceil(total / size)) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireApi("products:edit");
  const data = parse(ProductInput, await req.json());
  await connectDB();
  const p = await Product.create(data);
  await PriceLog.create({
    product: p._id,
    productCode: p.code,
    productName: p.name,
    user: user.id,
    userName: user.name,
    source: "edicion",
    changes: [{ field: "alta", from: null, to: "Producto creado" }],
  });
  return NextResponse.json({ product: p }, { status: 201 });
});
