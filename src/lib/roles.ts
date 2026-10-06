export const ROLES = ["admin", "encargado", "vendedor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  encargado: "Encargado de precios",
  vendedor: "Vendedor / mostrador",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Todo: estadísticas, usuarios, ajustes, precios, ventas, cancelaciones, bajas y cortes de caja.",
  encargado: "Edita precios, ve todas las ventas, autoriza clientes preferenciales, da de baja clientes y productos y hace cortes de caja.",
  vendedor:
    "Lo mismo que el administrador (ventas de todos, precios, clientes preferenciales, cortes de caja, ajustes y usuarios vendedores), menos el tablero, cancelar ventas y dar de baja o borrar registros.",
};

const PERMISSIONS = {
  "sales:create": ["admin", "encargado", "vendedor"],
  "sales:viewAll": ["admin", "encargado", "vendedor"],
  "sales:cancel": ["admin"],
  /** Registrar devoluciones y cambios (cobrar diferencia o regresar efectivo). */
  "returns:create": ["admin", "encargado", "vendedor"],
  "products:view": ["admin", "encargado", "vendedor"],
  "products:edit": ["admin", "encargado", "vendedor"],
  /** Dar de baja productos (también desmarcar «Activo»). */
  "products:delete": ["admin", "encargado"],
  /** Crear usuarios, cambiarles nombre, rol o contraseña (ver `canManageRole`). */
  "users:manage": ["admin", "vendedor"],
  /** Desactivar (dar de baja) usuarios. */
  "users:deactivate": ["admin"],
  /** Tablero de estadísticas. */
  "stats:view": ["admin"],
  "settings:edit": ["admin", "vendedor"],
  /** Clientes y datos de facturación: alta y edición desde el mostrador. */
  "customers:manage": ["admin", "encargado", "vendedor"],
  /** Marcar clientes como preferenciales (pueden dejar saldo). */
  "customers:credit": ["admin", "encargado", "vendedor"],
  /** Dar de baja clientes. */
  "customers:delete": ["admin", "encargado"],
  /** Borrar datos de facturación de un cliente. */
  "billing:delete": ["admin", "encargado"],
  /** Registrar entradas/salidas de caja y caja chica. */
  "cash:move": ["admin", "encargado", "vendedor"],
  /** Hacer el corte de caja y ver el historial de cortes. */
  "cash:cut": ["admin", "encargado", "vendedor"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, perm: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[perm] as readonly Role[]).includes(role);
}

/**
 * ¿Puede `actor` administrar usuarios con el rol `target` (crearlos, editarlos, cambiarles la contraseña
 * o asignar ese rol)? Solo si `target` no tiene ningún permiso que a `actor` le falte: así nadie puede
 * darse más permisos creando o tomando otra cuenta (p. ej. un vendedor no toca administradores ni encargados).
 */
export function canManageRole(actor: Role | undefined | null, target: Role): boolean {
  if (!can(actor, "users:manage")) return false;
  return (Object.keys(PERMISSIONS) as Permission[]).every((p) => !can(target, p) || can(actor, p));
}

/** Roles que `actor` puede asignar al crear o editar usuarios. */
export function assignableRoles(actor: Role | undefined | null): Role[] {
  return ROLES.filter((r) => canManageRole(actor, r));
}

/** Página de inicio: la pantalla de accesos rápidos para todos los roles. */
export function homeFor(_role: Role): string {
  return "/inicio";
}
