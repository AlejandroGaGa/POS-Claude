import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { UNIT_TYPES } from "../pricing";

const BarSchema = new Schema({ lengthM: { type: Number, required: true }, price: { type: Number, required: true } }, { _id: false });
const SheetSchema = new Schema(
  { widthM: { type: Number, default: 0 }, heightM: { type: Number, default: 0 }, price: { type: Number, default: 0 } },
  { _id: false },
);

const ProductSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, default: "General" },
    // Agrupa variantes del mismo producto (p. ej. un perfil en varios colores) en una sola tarjeta del mostrador.
    group: { type: String, trim: true, default: "" },
    line: { type: String, trim: true, default: "" }, // p. ej. "Línea 2\"", "Serie 35"
    color: { type: String, trim: true, default: "" }, // p. ej. natural, blanco, negro
    unitType: { type: String, enum: UNIT_TYPES, required: true },
    unitLabel: { type: String, trim: true, default: "pza" },
    price: { type: Number, default: null },
    pricePerMeter: { type: Number, default: null },
    bars: { type: [BarSchema], default: [] },
    minCutM: { type: Number, default: 0.5 },
    pricePerM2: { type: Number, default: null },
    pricePerM2Vidriero: { type: Number, default: null },
    sheets: { type: [SheetSchema], default: [] },
    notes: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ProductSchema.index({ category: 1, name: 1 });
ProductSchema.index({ group: 1 });

export type ProductDoc = InferSchemaType<typeof ProductSchema>;
export const Product: Model<ProductDoc> = models.Product || model("Product", ProductSchema);

/** Mismo modelo sin tipos estrictos, para bulkWrite con objetos planos. */
export const ProductRaw = Product as unknown as Model<Record<string, unknown>>;
