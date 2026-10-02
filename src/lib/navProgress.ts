/**
 * Estado global "navegando" (filtros, paginación, periodo). Mientras dure, se muestra la barra
 * de progreso superior y los resultados se atenúan (html[data-nav-pending]).
 */
type Fn = (pending: boolean) => void;
let count = 0;
const subs = new Set<Fn>();

function emit() {
  const pending = count > 0;
  if (typeof document !== "undefined") {
    if (pending) document.documentElement.setAttribute("data-nav-pending", "");
    else document.documentElement.removeAttribute("data-nav-pending");
  }
  subs.forEach((f) => f(pending));
}

export const navProgress = {
  start() {
    count++;
    emit();
  },
  done() {
    count = Math.max(0, count - 1);
    emit();
  },
  subscribe(f: Fn) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};
