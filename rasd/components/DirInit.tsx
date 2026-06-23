"use client";
import { useEffect } from "react";
import { applyDir } from "@/lib/i18n";

/** Applies the stored language's dir/lang to <html> on every page load. */
export default function DirInit() {
  useEffect(() => { applyDir(); }, []);
  return null;
}
