import { useEffect, useRef, useState } from 'react';

export const reducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

const coarsePointer = () =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Luz discreta que acompanha o cursor dentro do elemento (--mx / --my). */
export function spotlight(e: React.PointerEvent<HTMLElement>) {
  if (coarsePointer()) return;
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

/** Inclinação 3D pequena (até 4°) seguindo o cursor; some no pointer leave. */
export function tilt(e: React.PointerEvent<HTMLElement>) {
  if (coarsePointer() || reducedMotion()) return;
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  e.currentTarget.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
  e.currentTarget.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
  spotlight(e);
}
export function untilt(e: React.PointerEvent<HTMLElement>) {
  e.currentTarget.style.setProperty('--ry', '0deg');
  e.currentTarget.style.setProperty('--rx', '0deg');
}

/** Contagem animada: sobe do valor anterior até o novo em ~600 ms. */
export function useCountUp(value: number, duration = 600) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  const from = useRef(shown);
  useEffect(() => {
    if (reducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(origin + (value - origin) * eased);
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
}

/** Pausa as luzes ambiente quando a aba está oculta. */
export function useAmbientPause() {
  useEffect(() => {
    const sync = () =>
      document.documentElement.classList.toggle('is-hidden', document.hidden);
    sync();
    addEventListener('visibilitychange', sync);
    return () => removeEventListener('visibilitychange', sync);
  }, []);
}
