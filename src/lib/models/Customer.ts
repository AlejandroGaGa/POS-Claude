import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { CUSTOMER_TYPES } from "../pricing";

/** Cliente del mostrador. Se registra solo al vender/cotizar con nombre, o desde el módulo Clientes. */
const CustomerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    /** Solo dígitos del teléfono, para buscar y evitar duplicados. */
    phoneKey: { type: String, default: "", index: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    /** Precio de vidrio que se le aplica por defecto. */
    customerType: { type: String, enum: CUSTOMER_TYPES, default: "particular" },
    /** Cliente preferencial: puede llevarse material dejando saldo (pagos parciales). */
    preferential: { type: Boolean, default: false },
    /** Límite de crédito opcional (0 = sin límite). */
    creditLimit: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
CustomerSchema.index({ name: 1 });

export type CustomerDoc = InferSchemaType<typeof CustomerSchema>;
export const Customer: Model<CustomerDoc> = models.Customer || model("Customer", CustomerSchema);

export const phoneKey = (p?: string | null) => (p || "").replace(/\D/g, "").slice(-10);
