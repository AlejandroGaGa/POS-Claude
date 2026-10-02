import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { CASH_BOXES, MOVEMENT_TYPES } from "../cashConstants";
export * from "../cashConstants";

/** Entrada o salida de efectivo de la caja de mostrador o de la caja chica. */
const CashMovementSchema = new Schema(
  {
    box: { type: String, enum: CASH_BOXES, required: true, index: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    concept: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    description: { type: String, trim: true, default: "" },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    userName: String,
    /** Movimientos ligados (traspaso entre cajas). */
    pairId: { type: String, default: "" },
  },
  { timestamps: true },
);
CashMovementSchema.index({ createdAt: -1 });

export type CashMovementDoc = InferSchemaType<typeof CashMovementSchema>;
export const CashMovement: Model<CashMovementDoc> = models.CashMovement || model("CashMovement", CashMovementSchema);

/** Corte de caja: lo que debía haber en efectivo contra lo contado, por periodo. */
const CashCutSchema = new Schema(
  {
    folio: { type: String, required: true, unique: true },
    from: { type: Date, required: true },
    to: { type: Date, required: true, index: true },
    openingFloat: { type: Number, default: 0 }, // fondo con el que inició
    cashSales: { type: Number, default: 0 }, // ventas pagadas en efectivo
    cashPayments: { type: Number, default: 0 }, // abonos en efectivo
    entries: { type: Number, default: 0 }, // entradas manuales a la caja
    exits: { type: Number, default: 0 }, // salidas manuales de la caja
    expected: { type: Number, default: 0 },
    counted: { type: Number, default: 0 },
    difference: { type: Number, default: 0 }, // contado − esperado
    withdrawn: { type: Number, default: 0 }, // lo que se retira / deposita
    leftFloat: { type: Number, default: 0 }, // queda como fondo del siguiente periodo
    byMethod: {
      efectivo: { type: Number, default: 0 },
      transferencia: { type: Number, default: 0 },
      terminal: { type: Number, default: 0 },
    },
    commissions: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },
    notes: { type: String, trim: true, default: "" },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    userName: String,
  },
  { timestamps: true },
);

export type CashCutDoc = InferSchemaType<typeof CashCutSchema>;
export const CashCut: Model<CashCutDoc> = models.CashCut || model("CashCut", CashCutSchema);
