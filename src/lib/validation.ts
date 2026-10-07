import { z } from "zod";
import { HttpError } from "./errors";
import { CUSTOMER_TYPES, PAYMENT_METHODS, SALE_MODES, UNIT_TYPES } from "./pricing";
import { ROLES } from "./roles";
import { RETURN_MODES } from "./returns";
import { CUSTOM_MAX_PRICE, isCustomMode } from "./customItem";

/** Valida y lanza un 400 con el primer mensaje legible. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issue = r.error.issues[0];
    const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
    throw new HttpError(400, `${where}${issue.message}`);
  }
  return r.data;
}

const num = z.coerce.number().finite();
const optNum = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), num.min(0).nullable());

export const ProductInput = z.object({
  code: z.string().trim().toUpperCase().min(1, "El código es obligatorio").max(40),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  category: z.string().trim().min(1, "La categoría es obligatoria").max(60),
  line: z.string().trim().max(60).optional().default(""),
  color: z.string().trim().max(40).optional().default(""),
  unitType: z.enum(UNIT_TYPES),
  unitLabel: z.string().trim().max(20).optional().default("pza"),
  price: optNum.optional().default(null),
  pricePerMeter: optNum.optional().default(null),
  bars: z
    .array(z.object({ lengthM: num.positive("Largo de tira inválido"), price: num.min(0) }))
    .optional()
    .default([]),
  minCutM: num.positive().max(10).optional().default(0.5),
  pricePerM2: optNum.optional().default(null),
  pricePerM2Vidriero: optNum.optional().default(null),
  sheets: z
    .array(z.object({ widthM: num.min(0), heightM: num.min(0), price: num.min(0) }))
    .optional()
    .default([]),
  group: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  active: z.boolean().optional().default(true),
});
export type ProductInputT = z.infer<typeof ProductInput>;

/** Producto fuera de catálogo: lo captura el vendedor en la venta y no se da de alta. */
export const CustomItemSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del producto").max(160),
  price: num.positive("El precio debe ser mayor a 0").max(CUSTOM_MAX_PRICE, "El precio es demasiado alto"),
  unitLabel: z.string().trim().max(20).optional(),
});

/** Un renglón: un producto del catálogo (`productId`) o uno fuera de catálogo (`custom`), nunca los dos. */
export const LineInputSchema = z
  .object({
    productId: z.string().min(1).optional(),
    custom: CustomItemSchema.optional(),
    mode: z.enum(SALE_MODES),
    qty: num.positive("La cantidad debe ser mayor a 0"),
    lengthM: num.positive().optional(),
    barLengthM: num.positive().optional(),
    widthM: num.positive().optional(),
    heightM: num.positive().optional(),
  })
  .superRefine((l, ctx) => {
    if (!!l.productId === !!l.custom) ctx.addIssue({ code: "custom", message: "Cada renglón lleva un producto del catálogo o uno fuera de catálogo." });
    else if (l.custom && !isCustomMode(l.mode)) ctx.addIssue({ code: "custom", message: "Un producto fuera de catálogo se vende por pieza, kilo o metro." });
  });

export const SaleInput = z.object({
  kind: z.enum(["venta", "cotizacion"]),
  items: z.array(LineInputSchema).min(1, "Agrega al menos un producto").max(200),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  commissionPct: num.min(0).max(20).optional().default(0),
  cashReceived: optNum.optional().default(null),
  customerType: z.enum(CUSTOMER_TYPES).optional().default("particular"),
  customerName: z.string().trim().max(120).optional().default(""),
  customerPhone: z.string().trim().max(30).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  customerId: z.string().trim().max(40).nullable().optional(),
  /** Monto que paga hoy (cliente preferencial). Vacío = paga todo. */
  payNow: optNum.optional().default(null),
  /** Pesos de más repartidos en los precios (no se imprime). */
  extraAmount: optNum.optional().default(null),
  /** Descuento especial en % (se imprime). */
  discountPct: num.min(0).max(90, "El descuento no puede pasar de 90%").optional().default(0),
});

/** Edición de una cotización: lo mismo que una venta nueva, sin el tipo ni el efectivo. */
export const QuoteUpdateInput = SaleInput.omit({ kind: true, cashReceived: true, payNow: true });

export const ConvertInput = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  commissionPct: num.min(0).max(20).optional().default(0),
  cashReceived: optNum.optional().default(null),
  payNow: optNum.optional().default(null),
});

export const PaymentInput = z.object({
  amount: num.positive("El abono debe ser mayor a 0"),
  paymentMethod: z.enum(PAYMENT_METHODS),
  commissionPct: num.min(0).max(20).optional().default(0),
  cashReceived: optNum.optional().default(null),
  note: z.string().trim().max(200).optional().default(""),
});

export const CustomerInput = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del cliente").max(120),
  phone: z.string().trim().max(30).optional().default(""),
  email: z.union([z.literal(""), z.string().trim().email("Correo no válido")]).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  customerType: z.enum(CUSTOMER_TYPES).optional().default("particular"),
  preferential: z.boolean().optional(),
  creditLimit: num.min(0).optional(),
  active: z.boolean().optional(),
});

export const BillingInput = z.object({
  customerId: z.string().trim().min(1, "Elige el cliente"),
  legalName: z.string().trim().min(2, "Escribe la razón social").max(200),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, "RFC no válido (12 o 13 caracteres)"),
  taxRegime: z.string().trim().max(120).optional().default(""),
  cfdiUse: z.string().trim().max(120).optional().default(""),
  zip: z.union([z.literal(""), z.string().trim().regex(/^\d{5}$/, "El código postal son 5 dígitos")]).optional().default(""),
  email: z.union([z.literal(""), z.string().trim().email("Correo no válido")]).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  notes: z.string().trim().max(300).optional().default(""),
});

export const CashMovementInput = z.object({
  box: z.enum(["caja", "chica"]),
  type: z.enum(["entrada", "salida"]),
  concept: z.string().trim().min(2, "Escribe el concepto").max(80),
  amount: num.positive("La cantidad debe ser mayor a 0").max(10_000_000),
  description: z.string().trim().max(300).optional().default(""),
});

export const CashTransferInput = z.object({
  from: z.enum(["caja", "chica"]),
  amount: num.positive("La cantidad debe ser mayor a 0").max(10_000_000),
  description: z.string().trim().max(300).optional().default(""),
});

export const CashCutInput = z.object({
  counted: num.min(0, "Captura el efectivo contado"),
  withdrawn: num.min(0).optional().default(0),
  notes: z.string().trim().max(500).optional().default(""),
});

export const UserCreate = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "Usuario: 3 a 30 caracteres, solo letras, números, punto, guion"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(100),
  role: z.enum(ROLES),
});

export const UserUpdate = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(100).optional().or(z.literal("")),
});

export const SettingsInput = z.object({
  businessName: z.string().trim().min(1).max(120),
  address: z.string().trim().max(200).default(""),
  phone: z.string().trim().max(60).default(""),
  rfc: z.string().trim().max(20).default(""),
  ticketFooter: z.string().trim().max(300).default(""),
  defaultCommissionPct: num.min(0).max(20),
  quoteValidityDays: z.coerce.number().int().min(1).max(90),
});

export const BulkAdjustInput = z.object({
  category: z.string().trim().nullable().optional(),
  pct: num.min(-50).max(200),
  roundTo: num.min(0).max(100).default(0),
  apply: z.boolean().default(false),
});

/**
 * Devolución o cambio. Con nota: `returned` dice qué renglones de la venta regresan y cuántos.
 * Sin nota: `returnedLines` se capturan del catálogo (a precio actual). `newItems` es lo que se lleva.
 */
export const ReturnInput = z.object({
  saleId: z.string().trim().max(40).nullable().optional(),
  returned: z
    .array(z.object({ index: z.coerce.number().int().min(0), qty: num.positive("La cantidad a devolver debe ser mayor a 0") }))
    .max(200)
    .optional()
    .default([]),
  returnedLines: z.array(LineInputSchema).max(200).optional().default([]),
  newItems: z.array(LineInputSchema).max(200).optional().default([]),
  mode: z.enum(RETURN_MODES),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  commissionPct: num.min(0).max(20).optional().default(0),
  cashReceived: optNum.optional().default(null),
  customerType: z.enum(CUSTOMER_TYPES).optional().default("particular"),
  customerName: z.string().trim().max(120).optional().default(""),
  customerPhone: z.string().trim().max(30).optional().default(""),
  customerId: z.string().trim().max(40).nullable().optional(),
  reason: z.string().trim().min(3, "Escribe el motivo de la devolución").max(200),
  notes: z.string().trim().max(500).optional().default(""),
});
export type ReturnInputT = z.infer<typeof ReturnInput>;
