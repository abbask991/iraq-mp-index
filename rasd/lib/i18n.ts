export type Lang = "ar" | "en";

export function getLang(): Lang {
  if (typeof window === "undefined") return "ar";
  return (localStorage.getItem("lang") as Lang) === "en" ? "en" : "ar";
}

/** Apply dir/lang to <html> for the current stored language. */
export function applyDir() {
  if (typeof document === "undefined") return;
  const l = getLang();
  document.documentElement.setAttribute("dir", l === "ar" ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", l);
}

export function setLang(l: Lang) {
  localStorage.setItem("lang", l);
  applyDir();
  location.reload();
}

/** Pick the right string: tr({ar,en}). */
export function tr(s: { ar: string; en: string }, l: Lang): string {
  return l === "en" ? s.en : s.ar;
}
