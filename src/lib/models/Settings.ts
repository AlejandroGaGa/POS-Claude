import { Schema, model, models, type Model } from "mongoose";

export interface SettingsData {
  businessName: string;
  address: string;
  phone: string;
  rfc: string;
  ticketFooter: string;
  defaultCommissionPct: number;
  quoteValidityDays: number;
}

export const DEFAULT_SETTINGS: SettingsData = {
  businessName: "Herrajes y Aluminio",
  address: "",
  phone: "",
  rfc: "",
  ticketFooter: "Gracias por su compra. Precios sujetos a cambio sin previo aviso.",
  defaultCommissionPct: 4,
  quoteValidityDays: 7,
};

const SettingsSchema = new Schema({
  _id: { type: String, default: "global" },
  businessName: String,
  address: String,
  phone: String,
  rfc: String,
  ticketFooter: String,
  defaultCommissionPct: Number,
  quoteValidityDays: Number,
});

export const Settings: Model<SettingsData & { _id: string }> = models.Settings || model("Settings", SettingsSchema);

export async function getSettings(): Promise<SettingsData> {
  const s = await Settings.findById("global").lean();
  const merged = { ...DEFAULT_SETTINGS };
  if (s) {
    for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof SettingsData)[]) {
      const v = s[k];
      if (v !== undefined && v !== null) (merged as Record<string, unknown>)[k] = v;
    }
  }
  return merged;
}
