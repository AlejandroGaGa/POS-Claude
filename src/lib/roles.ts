export const ROLES = ["admin", "encargado", "vendedor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  encargado: "Encargado de precios",
  vendedor: "Vendedor / mostrador",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Todo: estadísticas, usuarios, ajustes, precios, ventas, cancelaciones y cortes de caja.",
  encargado: "Edita precios, ve todas las ventas, autoriza clientes preferenciales y hace cortes de caja.",
  vendedor: "Cotiza y vende, registra clientes, abonos y movimientos de caja; ve sus propias ventas.",
};

const PERMISSIONS = {
  "sales:create": ["admin", "encargado", "vendedor"],
  "sales:viewAll": ["admin", "encargado"],
  "sales:cancel": ["admin"],
  /** Registrar devoluciones y cambios (cobrar diferencia o regresar efectivo). */
  "returns:create": ["admin", "encargado", "vendedor"],
  "products:view": ["admin", "encargado", "vendedor"],
  "products:edit": ["admin", "encargado"],
  "users:manage": ["admin"],
  "stats:view": ["admin"],
  "settings:edit": ["admin"],
  /** Clientes y datos de facturación: alta y edición desde el mostrador. */
  "customers:manage": ["admin", "encargado", "vendedor"],
  /** Marcar clientes como preferenciales (pueden dejar saldo) y borrar clientes. */
  "customers:credit": ["admin", "encargado"],
  /** Registrar entradas/salidas de caja y caja chica. */
  "cash:move": ["admin", "encargado", "vendedor"],
  /** Hacer el corte de caja y ver el historial de cortes. */
  "cash:cut": ["admin", "encargado"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, perm: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[perm] as readonly Role[]).includes(role);
}

/** Página de inicio: la pantalla de accesos rápidos para todos los roles. */
export function homeFor(_role: Role): string {
  return "/inicio";
}
