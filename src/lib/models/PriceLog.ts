import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** Historial de cambios de precio: quién, cuándo y de cuánto a cuánto. */
const PriceLogSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    productCode: String,
    productName: String,
    user: { type: Schema.Types.ObjectId, ref: "User" },
    userName: String,
    source: { type: String, enum: ["edicion", "ajuste-masivo", "importacion"], default: "edicion" },
    changes: [{ field: String, from: Schema.Types.Mixed, to: Schema.Types.Mixed, _id: false }],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type PriceLogDoc = InferSchemaType<typeof PriceLogSchema>;
export const PriceLog: Model<PriceLogDoc> = models.PriceLog || model("PriceLog", PriceLogSchema);
