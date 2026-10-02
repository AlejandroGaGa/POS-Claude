"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label, ListBox, SearchField, Select, type Key } from "@heroui/react";
import { cx } from "./ui";
import { usePendingProgress } from "./NavProgress";

/** Actualiza un parámetro de la URL sin recargar (los filtros aplican al instante). */
function useUrlParam(name: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  usePendingProgress(pending);
  const value = params.get(name) ?? "";
  const set = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(name, v);
    else next.delete(name);
    next.delete("pagina"); // un filtro nuevo vuelve a la primera página
    start(() => router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  return { value, set, pending };
}

export interface Option {
  value: string;
  label: string;
}

/** Select de HeroUI ligado a un parámetro de la URL. La opción con value "" es "todos". */
export function UrlSelect({ name, label, options, className }: { name: string; label: string; options: Option[]; className?: string }) {
  const { value, set } = useUrlParam(name);
  const ALL = "__all__";
  return (
    <Select
      variant="secondary"
      className={cx("min-w-0", className)}
      value={(value || ALL) as Key}
      onChange={(k) => set(k === ALL || k == null ? "" : String(k))}
    >
      <Label className="text-sm font-medium">{label}</Label>
      <Select.Trigger className="h-11 rounded-xl">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.value || ALL} id={o.value || ALL} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Búsqueda ligada a ?q= (aplica al dejar de escribir). */
export function UrlSearch({ name = "q", label, placeholder, className }: { name?: string; label: string; placeholder?: string; className?: string }) {
  const { value, set } = useUrlParam(name);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => set(text.trim()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <SearchField variant="secondary" className={cx("min-w-0", className)} value={text} onChange={setText} onSubmit={(v) => set(v.trim())}>
      <Label className="text-sm font-medium">{label}</Label>
      <SearchField.Group className="h-11 rounded-xl">
        <SearchField.SearchIcon />
        <SearchField.Input placeholder={placeholder} />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}
