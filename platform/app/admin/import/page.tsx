"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// minimal CSV parser (handles quoted fields)
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const header = rows.shift() || [];
  return rows.filter((r) => r.some((x) => x.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const MP_COLS = ["id", "name", "governorate", "bloc", "committee", "role", "photo",
  "facebook", "x", "instagram", "telegram", "website", "search_name"];

export default function AdminImport() {
  const [url, setUrl] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [msg, setMsg] = useState("");

  async function fetchSheet() {
    setMsg("جارٍ الجلب…"); setRows([]);
    const res = await fetch("/api/import-sheet", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const j = await res.json();
    if (j.error) { setMsg(j.error); return; }
    const parsed = parseCSV(j.csv);
    setRows(parsed);
    setMsg(`تم جلب ${parsed.length} صف. راجعها ثم استورد.`);
  }

  async function importRows() {
    setMsg("جارٍ الاستيراد…");
    const recs = rows.map((r) => {
      const o: any = {};
      for (const c of MP_COLS) {
        const v = r[c] ?? r[c === "id" ? "member_id" : c];
        if (v !== undefined && v !== "") o[c] = c === "id" ? Number(v) : v;
      }
      return o;
    }).filter((o) => o.id && o.name);
    const { error } = await supabase.from("mps").upsert(recs, { onConflict: "id" });
    setMsg(error ? `خطأ: ${error.message}` : `✅ استُورد ${recs.length} نائب`);
  }

  return (
    <div>
      <h2>استيراد من Google Sheet</h2>
      <p className="muted">شارك الجدول «أي شخص لديه الرابط يمكنه العرض»، ألصق الرابط، ثم جلب → استيراد.
        الأعمدة المتوقّعة: id (أو member_id)، name، governorate، bloc، …</p>
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <input placeholder="https://docs.google.com/spreadsheets/d/…" value={url}
          onChange={(e) => setUrl(e.target.value)} />
        <button className="btn" onClick={fetchSheet}>جلب</button>
      </div>
      {msg && <p className="muted">{msg}</p>}
      {rows.length > 0 && (
        <>
          <div className="card" style={{ maxHeight: 280, overflow: "auto", margin: "10px 0" }}>
            {rows.slice(0, 20).map((r, i) => (
              <div key={i} style={{ fontSize: 12, borderBottom: "1px solid var(--line)", padding: "5px 0" }}>
                {r.id || r.member_id} · {r.name} · {r.governorate} · {r.bloc}
              </div>
            ))}
            {rows.length > 20 && <div className="muted" style={{ fontSize: 12, paddingTop: 6 }}>… و{rows.length - 20} صف آخر</div>}
          </div>
          <button className="btn" onClick={importRows}>استيراد {rows.length} نائب</button>
        </>
      )}
    </div>
  );
}
