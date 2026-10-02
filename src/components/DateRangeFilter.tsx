"use client";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateField, DateRangePicker, Label, RangeCalendar } from "@heroui/react";
import { I18nProvider } from "react-aria-components";
import {
  endOfMonth,
  endOfYear,
  parseDate,
  startOfMonth,
  startOfYear,
  today,
  type CalendarDate,
  type DateValue,
} from "@internationalized/date";
import { cx } from "./ui";
import Icon from "./Icon";
import { usePendingProgress } from "./NavProgress";
import { motion } from "framer-motion";
import { PILL_SPRING } from "./motion";

const TZ = process.env.NEXT_PUBLIC_TZ || "America/Mexico_City";
type Range = { start: DateValue; end: DateValue };

interface Preset {
  id: string;
  label: string;
  /** Etiqueta corta para los chips rápidos. */
  chip?: string;
  range: (t: CalendarDate) => { start: CalendarDate; end: CalendarDate };
}

const PRESETS: Preset[] = [
  { id: "hoy", label: "Hoy", chip: "Hoy", range: (t) => ({ start: t, end: t }) },
  { id: "ayer", label: "Ayer", range: (t) => ({ start: t.subtract({ days: 1 }), end: t.subtract({ days: 1 }) }) },
  { id: "7d", label: "Últimos 7 días", chip: "7 días", range: (t) => ({ start: t.subtract({ days: 6 }), end: t }) },
  { id: "30d", label: "Últimos 30 días", chip: "30 días", range: (t) => ({ start: t.subtract({ days: 29 }), end: t }) },
  { id: "mes", label: "Este mes", chip: "Este mes", range: (t) => ({ start: startOfMonth(t), end: t }) },
  {
    id: "mes-pasado",
    label: "Mes pasado",
    range: (t) => {
      const p = t.subtract({ months: 1 });
      return { start: startOfMonth(p), end: endOfMonth(p) };
    },
  },
  { id: "anio", label: "Este año", range: (t) => ({ start: startOfYear(t), end: t }) },
  {
    id: "anio-pasado",
    label: "Año pasado",
    range: (t) => {
      const p = t.subtract({ years: 1 });
      return { start: startOfYear(p), end: endOfYear(p) };
    },
  },
];

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return match;
}

const sameDay = (a: DateValue, b: DateValue) => a.compare(b) === 0;

function CalendarMonth({ offset, showPrev, showNext }: { offset?: number; showPrev: boolean; showNext: boolean }) {
  const o = offset ? { months: offset } : undefined;
  return (
    <div className="w-[17.25rem]">
      <RangeCalendar.Header>
        {showPrev ? <RangeCalendar.NavButton slot="previous" aria-label="Mes anterior" /> : <span className="size-8" />}
        <RangeCalendar.Heading className="flex-1 text-center text-[15px] font-semibold first-letter:uppercase" offset={o} />
        {showNext ? <RangeCalendar.NavButton slot="next" aria-label="Mes siguiente" /> : <span className="size-8" />}
      </RangeCalendar.Header>
      <RangeCalendar.Grid offset={o}>
        <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
        <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
      </RangeCalendar.Grid>
    </div>
  );
}

/**
 * Filtro de fechas: chips de un toque (Hoy, 7 días…) + selector de rango con
 * atajos y calendario (2 meses en escritorio, 1 en celular). Sincroniza
 * ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD en la URL, conservando los demás filtros.
 */
export default function DateRangeFilter({
  desde,
  hasta,
  label = "Periodo",
  chips = true,
  className,
}: {
  desde: string;
  hasta: string;
  label?: string;
  chips?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  usePendingProgress(pending);
  const wide = useMediaQuery("(min-width: 1100px)");
  const t = useMemo(() => today(TZ), []);
  const [value, setValue] = useState<Range | null>(() => ({ start: parseDate(desde), end: parseDate(hasta) }));
  const [open, setOpen] = useState(false);
  const pillId = useId();

  // Si la URL cambia desde fuera (atrás/adelante), reflejarlo.
  useEffect(() => setValue({ start: parseDate(desde), end: parseDate(hasta) }), [desde, hasta]);

  const activePreset = value
    ? PRESETS.find((p) => {
        const r = p.range(t);
        return sameDay(r.start, value.start) && sameDay(r.end, value.end);
      })?.id
    : undefined;

  function apply(r: Range | null) {
    setValue(r);
    if (!r) return;
    const next = new URLSearchParams(params.toString());
    next.set("desde", r.start.toString());
    next.set("hasta", r.end.toString());
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <I18nProvider locale="es-MX">
      <div className={cx("flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between", className)} aria-busy={pending}>
        {chips && (
          <div role="group" aria-label="Periodos rápidos" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {PRESETS.filter((p) => p.chip).map((p) => {
              const active = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => apply(p.range(t))}
                  className={cx(
                    "relative min-h-11 shrink-0 rounded-full bg-default px-4 text-sm font-semibold transition-[color,background-color,transform] duration-150 outline-none active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-focus",
                    active ? "text-accent-foreground" : "text-foreground hover:bg-default-hover",
                  )}
                >
                  {active && <motion.span layoutId={`${pillId}-chip`} transition={PILL_SPRING} className="absolute inset-0 rounded-full bg-accent" />}
                  <span className="relative">{p.chip}</span>
                </button>
              );
            })}
          </div>
        )}

        <DateRangePicker
          className="w-full md:w-auto"
          value={value}
          onChange={apply}
          maxValue={t}
          isOpen={open}
          onOpenChange={setOpen}
          startName="desde"
          endName="hasta"
        >
          <Label className="sr-only">{label}</Label>
          <DateField.Group fullWidth className="h-11 rounded-xl bg-default pl-4 shadow-none md:min-w-[19rem]">
            <span className="mr-2 text-muted" aria-hidden>
              <Icon name="calendar" className="size-4" />
            </span>
            <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
            <DateRangePicker.RangeSeparator />
            <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
            <DateField.Suffix>
              <DateRangePicker.Trigger aria-label="Abrir calendario">
                <DateRangePicker.TriggerIndicator />
              </DateRangePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>

          <DateRangePicker.Popover className="max-w-[calc(100vw-1.5rem)] rounded-3xl p-0" placement="bottom end">
            <div className="flex flex-col md:flex-row">
              {/* Atajos */}
              <div
                role="group"
                aria-label="Atajos de fecha"
                className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-separator p-3 md:w-44 md:flex-col md:overflow-visible md:border-r md:border-b-0"
              >
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      apply(p.range(t));
                      setOpen(false);
                    }}
                    className={cx(
                      "min-h-10 shrink-0 rounded-xl px-3 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus",
                      activePreset === p.id ? "bg-accent-soft text-accent-soft-foreground" : "hover:bg-default",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Calendario */}
              <div className="p-3">
                <RangeCalendar
                  aria-label={label}
                  visibleDuration={{ months: wide ? 2 : 1 }}
                  defaultFocusedValue={wide && value ? value.end.subtract({ months: 1 }) : (value?.end ?? t)} className={cx("max-w-none", wide ? "w-[36.5rem]" : "w-[17.5rem]")}>
                  <div className="flex gap-8">
                    <CalendarMonth showPrev showNext={!wide} />
                    {wide && <CalendarMonth offset={1} showPrev={false} showNext />}
                  </div>
                </RangeCalendar>
                <p className="mt-2 px-1 text-sm text-muted">Toca el día inicial y luego el final.</p>
              </div>
            </div>
          </DateRangePicker.Popover>
        </DateRangePicker>
      </div>
    </I18nProvider>
  );
}
