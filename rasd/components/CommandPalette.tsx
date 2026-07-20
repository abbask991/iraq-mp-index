"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { label: string; href: string; group?: string };

export default function CommandPalette({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => { if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  const raw = q.trim();
  const term = raw.toLowerCase();
  const sections = term ? items.filter((i) => i.label.toLowerCase().includes(term) || (i.group || "").toLowerCase().includes(term)) : items;
  // typing a name → offer to analyze it directly across the intelligence engines
  const enc = encodeURIComponent(raw);
  const entityActions: Item[] = raw.length >= 2 ? [
    { label: `الرأي العام: «${raw}»`, href: `/monitor/analysis?tab=opinion&q=${enc}`, group: "تحليل" },
    { label: `الصورة الموحّدة: «${raw}»`, href: `/monitor/sources?src=overview&q=${enc}`, group: "تحليل" },
    { label: `الاستخبارات المؤسسية: «${raw}»`, href: `/monitor/corporate?q=${enc}`, group: "تحليل" },
    { label: `استطلاع الرأي: «${raw}»`, href: `/monitor/analysis?tab=polling&q=${enc}`, group: "تحليل" },
  ] : [];
  const filtered = [...sections, ...entityActions];
  const go = (href: string) => { setOpen(false); router.push(href); };

  return (
    <>
      <button className="cb-btn cmdk-trigger" onClick={() => setOpen(true)} title="بحث سريع (Ctrl+K)">
        <span>⌕ بحث</span><kbd>⌘K</kbd>
      </button>
      {open && (
        <div className="cmdk-overlay" onClick={() => setOpen(false)}>
          <div className="cmdk" onClick={(e) => e.stopPropagation()}>
            <input ref={inputRef} className="cmdk-input" placeholder="اقفز لأي قسم… أو اكتب للبحث" value={q}
              onChange={(e) => { setQ(e.target.value); setIdx(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter" && filtered[idx]) go(filtered[idx].href);
              }} />
            <div className="cmdk-list">
              {filtered.map((it, i) => (
                <button key={it.href} className={"cmdk-item" + (i === idx ? " active" : "")}
                  onMouseEnter={() => setIdx(i)} onClick={() => go(it.href)}>
                  <span>{it.label}</span>
                  {it.group && <span className="cmdk-group">{it.group}</span>}
                </button>
              ))}
              {!filtered.length && <div className="muted" style={{ padding: 16, textAlign: "center" }}>لا نتائج لـ «{q}»</div>}
            </div>
            <div className="cmdk-foot"><span className="muted">↑↓ تنقّل · ⏎ فتح · Esc إغلاق</span></div>
          </div>
        </div>
      )}
    </>
  );
}
