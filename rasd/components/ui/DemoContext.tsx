"use client";
import { createContext, useContext, useEffect, useState } from "react";

/**
 * One demo switch for the whole console.
 *
 * Every page used to own a `useState(false)` and its own toggle, so demo had to
 * be turned on again on each page — and half-on/half-off states were possible
 * mid-presentation, which is exactly when they hurt most. This lifts it to one
 * switch in the console bar, persisted, so the whole product flips together.
 *
 * Persisted in localStorage: navigating between pages is a remount, and a demo
 * that silently switched itself off on every navigation would be worse than no
 * demo at all.
 */
const KEY = "rasd_demo";

type Ctx = { demo: boolean; setDemo: (v: boolean) => void };
const DemoCtx = createContext<Ctx>({ demo: false, setDemo: () => {} });

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demo, setD] = useState(false);
  const [ready, setReady] = useState(false);

  // read after mount — localStorage does not exist during SSR
  useEffect(() => {
    try { setD(localStorage.getItem(KEY) === "1"); } catch { /* ignore */ }
    setReady(true);
  }, []);

  const setDemo = (v: boolean) => {
    setD(v);
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
  };

  // `ready` guards the first paint: without it every page would fetch real data
  // on mount and refetch demo a tick later, doubling requests and flashing.
  return <DemoCtx.Provider value={{ demo: ready ? demo : false, setDemo }}>{children}</DemoCtx.Provider>;
}

export const useDemo = () => useContext(DemoCtx);
