import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** Datos para facturar de un cliente (sin timbrado). Un cliente puede tener varias razones sociales. */
const BillingProfileSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    customerName: String,
    legalName: { type: String, required: true, trim: true }, // razón social
    rfc: { type: String, required: true, trim: true, uppercase: true, index: true },
    taxRegime: { type: String, trim: true, default: "" }, // régimen fiscal (clave SAT)
    cfdiUse: { type: String, trim: true, default: "" }, // uso del CFDI (clave SAT)
    zip: { type: String, trim: true, default: "" }, // código postal fiscal
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

export type BillingProfileDoc = InferSchemaType<typeof BillingProfileSchema>;
export const BillingProfile: Model<BillingProfileDoc> = models.BillingProfile || model("BillingProfile", BillingProfileSchema);
