/** Constantes de caja (sin dependencias de servidor; se usan también en el navegador). */
export const CASH_BOXES = ["caja", "chica"] as const;
export type CashBox = (typeof CASH_BOXES)[number];
export const CASH_BOX_LABELS: Record<CashBox, string> = { caja: "Caja de mostrador", chica: "Caja chica" };
export const MOVEMENT_TYPES = ["entrada", "salida"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Conceptos sugeridos (se puede escribir cualquier otro). */
export const CONCEPTS: Record<MovementType, string[]> = {
  entrada: ["Fondo de caja", "Aportación del dueño", "Cobro fuera de sistema", "Traspaso", "Otro ingreso"],
  salida: ["Compra de material", "Pago a proveedor", "Fletes / gasolina", "Comida", "Servicios (luz, agua, internet)", "Sueldos", "Retiro del dueño", "Depósito al banco", "Traspaso", "Otro gasto"],
};

