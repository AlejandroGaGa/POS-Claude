"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label, TextField } from "@heroui/react";
import { Alert, Spinner } from "@/components/ui";

export default function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo entrar");
      const next = params.get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : data.redirect;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField name="username" isRequired variant="secondary" autoComplete="username">
        <Label>Usuario</Label>
        <Input id="username" autoCapitalize="none" autoFocus className="h-12" />
      </TextField>
      <TextField name="password" type="password" isRequired variant="secondary" autoComplete="current-password">
        <Label>Contraseña</Label>
        <Input id="password" className="h-12" />
      </TextField>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" size="lg" isPending={loading} className="mt-1 w-full rounded-full">
        {loading && <Spinner />}
        Entrar
      </Button>
    </form>
  );
}
