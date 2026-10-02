"use client";
import { btn } from "./ui";
import Icon from "./Icon";

export default function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className={btn("primary")}>
      <Icon name="print" /> {label}
    </button>
  );
}
