"use client";
import { useState } from "react";

/** Add/remove editor for a list of strings (news sources, keywords, hashtags). */
export default function ListEditor({
  title, placeholder, items, onChange,
}: {
  title: string; placeholder: string; items: string[]; onChange: (next: string[]) => void;
}) {
  const [val, setVal] = useState("");
  const add = () => {
    const v = val.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setVal("");
  };
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <b>{title}</b>
      <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
        <input placeholder={placeholder} value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn" onClick={add}>إضافة</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.length === 0 && <span className="muted">لا عناصر بعد.</span>}
        {items.map((it) => (
          <span key={it} style={{
            background: "#0e1626", border: "1px solid var(--line)", borderRadius: 8,
            padding: "5px 10px", fontSize: 13,
          }}>
            {it}{" "}
            <button onClick={() => onChange(items.filter((x) => x !== it))}
              style={{ background: "none", border: 0, color: "#f43f5e", cursor: "pointer" }}>✕</button>
          </span>
        ))}
      </div>
    </div>
  );
}
