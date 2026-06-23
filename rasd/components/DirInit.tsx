"use client";
import { useEffect } from "react";
import { applyDir, applyTheme } from "@/lib/i18n";

/** Applies the stored language dir + theme to <html> on every page load. */
export default function DirInit() {
  useEffect(() => { applyDir(); applyTheme(); }, []);
  return null;
}
