import { describe, expect, it } from "vitest";
import { assignableRoles, can, canManageRole, type Permission } from "@/lib/roles";

describe("permisos del vendedor", () => {
  it("puede lo mismo que el administrador en la operación diaria", () => {
    const granted: Permission[] = [
      "sales:create",
      "sales:viewAll",
      "returns:create",
      "products:view",
      "products:edit",
      "customers:manage",
      "customers:credit",
      "cash:move",
      "cash:cut",
      "settings:edit",
      "users:manage",
    ];
    for (const p of granted) expect(can("vendedor", p), p).toBe(true);
  });

  it("autoriza clientes preferenciales (necesario para cobrar en parcialidades)", () => {
    expect(can("vendedor", "customers:credit")).toBe(true);
  });

  it("no ve el tablero, no cancela ventas y no da de baja ni borra", () => {
    const denied: Permission[] = ["stats:view", "sales:cancel", "products:delete", "customers:delete", "billing:delete", "users:deactivate"];
    for (const p of denied) expect(can("vendedor", p), p).toBe(false);
  });

  it("el administrador conserva todo", () => {
    const all: Permission[] = ["stats:view", "sales:cancel", "products:delete", "customers:delete", "billing:delete", "users:deactivate", "users:manage", "settings:edit"];
    for (const p of all) expect(can("admin", p), p).toBe(true);
  });

  it("el encargado sigue igual: da de baja clientes y productos, sin usuarios ni ajustes", () => {
    expect(can("encargado", "products:delete")).toBe(true);
    expect(can("encargado", "customers:delete")).toBe(true);
    expect(can("encargado", "billing:delete")).toBe(true);
    expect(can("encargado", "users:manage")).toBe(false);
    expect(can("encargado", "settings:edit")).toBe(false);
    expect(can("encargado", "stats:view")).toBe(false);
  });
});

describe("administración de usuarios", () => {
  it("el vendedor solo administra vendedores: no puede darse más permisos con otra cuenta", () => {
    expect(canManageRole("vendedor", "vendedor")).toBe(true);
    expect(canManageRole("vendedor", "admin")).toBe(false);
    expect(canManageRole("vendedor", "encargado")).toBe(false);
    expect(assignableRoles("vendedor")).toEqual(["vendedor"]);
  });

  it("el administrador administra todos los roles", () => {
    expect(assignableRoles("admin")).toEqual(["admin", "encargado", "vendedor"]);
  });

  it("quien no administra usuarios no asigna ningún rol", () => {
    expect(assignableRoles("encargado")).toEqual([]);
    expect(canManageRole(null, "vendedor")).toBe(false);
  });
});
