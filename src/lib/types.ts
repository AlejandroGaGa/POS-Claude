import type { Bar, Sheet, UnitType } from "./pricing";

/** Producto tal como llega al navegador (JSON). */
export interface ProductJSON {
  _id: string;
  code: string;
  name: string;
  category: string;
  line?: string;
  color?: string;
  unitType: UnitType;
  unitLabel?: string;
  price?: number | null;
  pricePerMeter?: number | null;
  bars?: Bar[];
  minCutM?: number | null;
  pricePerM2?: number | null;
  pricePerM2Vidriero?: number | null;
  sheets?: Sheet[];
  group?: string;
  notes?: string;
  active: boolean;
  updatedAt?: string;
}
