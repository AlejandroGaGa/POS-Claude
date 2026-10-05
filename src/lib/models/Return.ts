import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { CUSTOMER_TYPES, PAYMENT_METHODS, SALE_MODES } from "../pricing";
import { RETURN_MODES, RETURN_OUTCOMES } from "../returns";

/** Renglón devuelto o renglón nuevo del cambio (misma forma que los renglones de una venta). */
const ReturnItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
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
    /** Índice del renglón en la venta original (solo en lo devuelto con nota). */
    saleItemIndex: { type: Number, default: null },
  },
  { _id: false },
);

/** Cobro de la diferencia (o de lo nuevo completo). */
const ChargeSchema = new Schema(
  {
    amount: { type: Number, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    commissionPct: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    cashReceived: { type: Number, default: null },
    change: { type: Number, default: null },
  },
  { _id: false },
);

/**
 * Devolución o cambio (folio D-000001). Guarda qué regresó el cliente, qué se llevó a cambio y
 * cómo se resolvió el dinero, para poder consultarlo después por folio, cliente o teléfono.
 * Puede estar ligada a una venta (y por ella a su cotización) o ser «sin nota».
 */
const ReturnSchema = new Schema(
  {
    folio: { type: String, required: true, unique: true },
    /** Venta original. null = devolución sin nota. */
    sale: { type: Schema.Types.ObjectId, ref: "Sale", default: null, index: true },
    saleFolio: { type: String, default: "", index: true },
    /** Cotización de la que salió la venta original, para buscar por C-…. */
    quoteFolio: { type: String, default: "", index: true },
    saleDate: Date,
    // Cliente: registrado (customer) o solo con nombre/teléfono capturado.
    customer: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, trim: true, default: "" },
    customerPhone: { type: String, trim: true, default: "" },
    customerType: { type: String, enum: CUSTOMER_TYPES, default: "particular" },

    returnedItems: { type: [ReturnItemSchema], default: [] },
    returnedTotal: { type: Number, required: true },
    newItems: { type: [ReturnItemSchema], default: [] },
    newTotal: { type: Number, default: 0 },

    mode: { type: String, enum: RETURN_MODES, required: true },
    outcome: { type: String, enum: RETURN_OUTCOMES, required: true, index: true },
    /** nuevo − devuelto (positivo: pagó el cliente; negativo: se le debía). */
    difference: { type: Number, default: 0 },
    charge: { type: ChargeSchema, default: null },
    chargeAmount: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    /** Efectivo que salió de la caja hacia el cliente. */
    refundAmount: { type: Number, default: 0 },
    /** Se descontó del saldo pendiente de la venta original. */
    appliedToBalance: { type: Number, default: 0 },
    /** Lo que absorbió el negocio (cortesía). */
    waivedAmount: { type: Number, default: 0 },
    /** Lo que el cliente dejó sin reembolso. */
    notRefundedAmount: { type: Number, default: 0 },

    reason: { type: String, trim: true, required: true },
    notes: { type: String, trim: true, default: "" },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: String,
  },
  { timestamps: true },
);

ReturnSchema.index({ createdAt: -1 });
ReturnSchema.index({ customerName: 1 });

export type ReturnDoc = InferSchemaType<typeof ReturnSchema>;
export const Return: Model<ReturnDoc> = models.Return || model("Return", ReturnSchema);
