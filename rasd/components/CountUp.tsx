"use client";
import { useEffect, useRef, useState } from "react";

// Smoothly animates a number up to `value` (ease-out cubic). Used for the
// cinematic war-room metrics so figures "tick up" on load/refresh.
export default function CountUp({ value, dur = 900, suffix = "" }: { value: number; dur?: number; suffix?: string }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    const diff = (value || 0) - start;
    let raf = 0;
    let t0 = 0;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(start + diff * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value || 0;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return <>{Math.round(v).toLocaleString()}{suffix}</>;
}
