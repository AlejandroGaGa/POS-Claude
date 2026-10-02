"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@/lib/roles";
import { Chip, Modal, Table } from "@heroui/react";
import { Alert, Button, Field, Input, Section, Select } from "./ui";
import Icon from "./Icon";

export interface UserRow {
  _id: string;
  name: string;
  username: string;
  role: Role;
  active: boolean;
}

async function call(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

export default function UsersManager({ users, meId, total }: { users: UserRow[]; meId: string; total?: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await call("/api/users", "POST", { name: f.get("name"), username: f.get("username"), password: f.get("password"), role: f.get("role") });
      form.reset();
      setMsg({ tone: "ok", text: "Usuario creado." });
      router.refresh();
    } catch (err) {
      setMsg({ tone: "bad", text: (err as Error).message });
    }
  }

  async function update(id: string, body: Record<string, unknown>, okText: string) {
    try {
      await call(`/api/users/${id}`, "PUT", body);
      setMsg({ tone: "ok", text: okText });
      router.refresh();
    } catch (err) {
      setMsg({ tone: "bad", text: (err as Error).message });
    }
  }

  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [pw, setPw] = useState("");

  const roleSelect = (u: UserRow, id: string) => (
    <Select id={id} aria-label={`Rol de ${u.name}`} defaultValue={u.role} onChange={(e) => update(u._id, { role: e.target.value }, `Rol de ${u.name} actualizado.`)} className="min-h-10">
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </Select>
  );
  const status = (u: UserRow) => (
    <span className="flex flex-wrap gap-1.5">
      <Chip size="sm" variant="soft" color={u.active ? "success" : "danger"}>
        <Chip.Label>{u.active ? "Activo" : "Inactivo"}</Chip.Label>
      </Chip>
      {u._id === meId && (
        <Chip size="sm" variant="soft" color="accent">
          <Chip.Label>Tú</Chip.Label>
        </Chip>
      )}
    </span>
  );
  const actions = (u: UserRow) => (
    <span className="flex flex-wrap justify-end gap-2">
      <Button variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => { setPw(""); setPwUser(u); }}>
        Contraseña
      </Button>
      {u._id !== meId && (
        <Button variant="secondary" className={u.active ? "min-h-10 px-4 text-sm text-danger" : "min-h-10 px-4 text-sm"} onClick={() => update(u._id, { active: !u.active }, u.active ? `${u.name} desactivado.` : `${u.name} reactivado.`)}>
          {u.active ? "Desactivar" : "Reactivar"}
        </Button>
      )}
    </span>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--sticky-top)+0.75rem)]">
        <Section title="Nuevo usuario">
          <form onSubmit={create} className="flex flex-col gap-4">
            <Field label="Nombre" htmlFor="n-name">
              <Input id="n-name" name="name" required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Usuario" htmlFor="n-user" hint="Sin espacios">
                <Input id="n-user" name="username" required autoCapitalize="none" pattern="[a-zA-Z0-9._\-]{3,30}" />
              </Field>
              <Field label="Contraseña" htmlFor="n-pass" hint="Mínimo 6">
                <Input id="n-pass" name="password" type="password" required minLength={6} autoComplete="new-password" />
              </Field>
            </div>
            <Field label="Rol" htmlFor="n-role">
              <Select id="n-role" name="role" defaultValue="vendedor">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit">
              <Icon name="plus" className="size-4" /> Crear usuario
            </Button>
          </form>
        </Section>
        <Section title="Roles">
          <dl className="flex flex-col gap-3 text-sm">
            {ROLES.map((r) => (
              <div key={r} className="border-l-2 border-accent/40 pl-3">
                <dt className="font-semibold">{ROLE_LABELS[r]}</dt>
                <dd className="text-muted">{ROLE_DESCRIPTIONS[r]}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>

      <Section title="Equipo" description={`${total ?? users.length} usuario(s)`}>
        <div className="flex flex-col gap-3">
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

          <ul className="flex flex-col divide-y divide-separator md:hidden">
            {users.map((u) => (
              <li key={u._id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-sm text-muted">@{u.username}</p>
                  </div>
                  {status(u)}
                </div>
                {roleSelect(u, `role-m-${u._id}`)}
                {actions(u)}
              </li>
            ))}
          </ul>

          <Table className="data-table hidden md:block" variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Usuarios">
                <Table.Header>
                  <Table.Column isRowHeader>Usuario</Table.Column>
                  <Table.Column>Rol</Table.Column>
                  <Table.Column>Estado</Table.Column>
                  <Table.Column className="text-right">Acciones</Table.Column>
                </Table.Header>
                <Table.Body>
                  {users.map((u) => (
                    <Table.Row key={u._id} id={u._id}>
                      <Table.Cell>
                        <span className="font-medium">{u.name}</span>
                        <span className="block text-xs text-muted">@{u.username}</span>
                      </Table.Cell>
                      <Table.Cell className="w-56">{roleSelect(u, `role-${u._id}`)}</Table.Cell>
                      <Table.Cell>{status(u)}</Table.Cell>
                      <Table.Cell>{actions(u)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </div>
      </Section>

      <Modal.Backdrop isOpen={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <Modal.Container placement="auto">
          <Modal.Dialog className="sm:max-w-sm">
            <Modal.CloseTrigger aria-label="Cerrar" />
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!pwUser) return;
                update(pwUser._id, { password: pw }, `Contraseña de ${pwUser.name} cambiada.`);
                setPwUser(null);
              }}
            >
              <Modal.Header>
                <Modal.Heading>Cambiar contraseña</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-sm text-muted">{pwUser?.name} usará la nueva contraseña la próxima vez que entre.</p>
                <Field label="Nueva contraseña" htmlFor="pw-new" hint="Mínimo 6 caracteres">
                  <Input id="pw-new" type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required autoComplete="new-password" autoFocus />
                </Field>
              </Modal.Body>
              <Modal.Footer className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setPwUser(null)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={pw.length < 6}>
                  Guardar
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
