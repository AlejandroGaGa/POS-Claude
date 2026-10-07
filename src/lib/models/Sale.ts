import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { CUSTOMER_TYPES, PAYMENT_METHODS, SALE_MODES } from "../pricing";

const ItemSchema = new Schema(
  {
    /** Producto del catálogo; `null` si es un producto fuera de catálogo (entonces `custom` es true). */
    product: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    custom: Boolean,
    code: String,
    name: String,
    category: String,
    mode: { type: String, enum: SALE_MODES, required: true },
    qty: { type: Number, required: true },
    lengthM: Number,
    barLengthM: Number,
    widthM: Number,
    heightM: Number,
    unitPrice: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    detail: String,
    /** Precio de lista al venderse (interno; nunca se imprime). Solo cuando hubo ajuste. */
    listUnitPrice: Number,
    /** Lo que se imprime en la nota: con el extra repartido y antes del descuento especial. */
    shownUnitPrice: Number,
    shownSubtotal: Number,
    /** Cantidad que ya se devolvió de este renglón (devoluciones y cambios). */
    returnedQty: { type: Number, default: 0 },
  },
  { _id: false },
);

/** Pago o abono a una venta. `amount` se descuenta del saldo; la comisión de terminal se cobra aparte. */
const PaymentSchema = new Schema(
  {
    amount: { type: Number, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    commissionPct: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    cashReceived: { type: Number, default: null },
    change: { type: Number, default: null },
    at: { type: Date, default: () => new Date() },
    userName: String,
    note: { type: String, default: "" },
  },
  { _id: true },
);

/** Una cotización o una venta. Una cotización convertida genera una venta nueva ligada. */
const SaleSchema = new Schema(
  {
    kind: { type: String, enum: ["venta", "cotizacion"], required: true, index: true },
    folio: { type: String, required: true, unique: true },
    status: { type: String, enum: ["vigente", "convertida", "cancelada"], default: "vigente", index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, trim: true, default: "" },
    customerPhone: { type: String, trim: true, default: "" },
    customerType: { type: String, enum: CUSTOMER_TYPES, default: "particular" },
    notes: { type: String, trim: true, default: "" },
    items: { type: [ItemSchema], default: [] },
    subtotal: { type: Number, required: true },
    // Ajustes de precio: extra repartido en los precios (oculto) y descuento especial (visible).
    extraAmount: { type: Number, default: 0 },
    discountPct: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    /** Suma de lo impreso antes del descuento (= subtotal si no hay descuento). */
    shownSubtotal: { type: Number, default: null },
    paymentMethod: { type: String, enum: [...PAYMENT_METHODS, null], default: null },
    commissionPct: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    cashReceived: { type: Number, default: null },
    change: { type: Number, default: null },
    seller: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerName: String,
    validUntil: Date, // cotizaciones
    fromQuote: { type: Schema.Types.ObjectId, ref: "Sale", default: null },
    fromQuoteFolio: String,
    convertedTo: { type: Schema.Types.ObjectId, ref: "Sale", default: null },
    convertedToFolio: String,
    // Pagos: una venta normal tiene un pago por el total; un cliente preferencial puede dejar saldo.
    payments: { type: [PaymentSchema], default: undefined },
    paid: { type: Number, default: null }, // suma aplicada al subtotal
    balance: { type: Number, default: 0, index: true }, // saldo pendiente
    paymentStatus: { type: String, enum: ["pagada", "parcial", null], default: null },
    cancelledAt: Date,
    cancelledByName: String,
    cancelReason: String,
    // Devoluciones y cambios ligados a esta venta
    returnedTotal: { type: Number, default: 0 }, // valor devuelto (a precio pagado)
    returns: { type: [{ _id: { type: Schema.Types.ObjectId, ref: "Return" }, folio: String, at: Date, outcome: String }], default: undefined },
    // Última edición de la cotización
    editedAt: Date,
    editedByName: String,
    // Último envío del PDF por WhatsApp
    whatsappSentAt: Date,
    whatsappSentTo: String,
    whatsappSentByName: String,
  },
  { timestamps: true },
);

SaleSchema.index({ kind: 1, createdAt: -1 });
SaleSchema.index({ fromQuoteFolio: 1 });

export type SaleDoc = InferSchemaType<typeof SaleSchema>;
export const Sale: Model<SaleDoc> = models.Sale || model("Sale", SaleSchema);
