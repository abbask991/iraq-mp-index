"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

/**
 * Per-tab lazy fetch for the corporate section.
 *
 * Every tab hits its OWN endpoint (reputation, fraud, complaints, …). The host
 * mounts only the active tab, so this fetches once per tab on first activation
 * and re-fetches when brand or the demo switch changes — never 9 requests on
 * open. `param` is "brand" for all tabs except reviews ("place").
 */
export function useBrand(endpoint: string, brand: string, demo: boolean, param: "brand" | "place" = "brand") {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true); setD(null);
    apiGet(`/api/corporate/${endpoint}?${param}=${encodeURIComponent(brand)}${demo ? "&demo=1" : ""}`)
      .then((r) => { if (alive) setD(r); })
      .catch(() => { if (alive) setD(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [endpoint, brand, demo, param]);
  return { d, loading };
}
