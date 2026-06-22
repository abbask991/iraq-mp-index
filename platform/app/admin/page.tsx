"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function AdminHome() {
  const [s, setS] = useState({ mps: 0, ratings: 0, comments: 0, pending: 0 });

  useEffect(() => {
    const count = async (t: string, f?: (q: any) => any) => {
      let q = supabase.from(t).select("*", { count: "exact", head: true });
      if (f) q = f(q);
      const { count } = await q;
      return count ?? 0;
    };
    (async () => {
      setS({
        mps: await count("mps"),
        ratings: await count("ratings"),
        comments: await count("comments"),
        pending: await count("comments", (q) => q.eq("status", "pending")),
      });
    })();
  }, []);

  const stats = [
    ["النواب", s.mps, false],
    ["التقييمات", s.ratings, false],
    ["التعليقات", s.comments, false],
    ["بانتظار المراجعة", s.pending, true],
  ] as const;

  const cards = [
    ["👤", "النواب", "تعديل الصور وروابط السوشيال والاسم البحثي", "/admin/mps"],
    ["⚙️", "الإعدادات", "مصادر الأخبار والكلمات والهاشتاغات", "/admin/settings"],
    ["💬", "التعليقات", "الموافقة على تعليقات المواطنين أو رفضها", "/admin/comments"],
    ["📤", "استيراد", "ربط Google Sheet لرفع الأسماء/الإحصاءات", "/admin/import"],
  ];

  return (
    <div>
      <h2>لوحة التحكم</h2>
      <p className="muted">نظرة عامة وإدارة الموقع — كل تغيير يُحفظ مباشرةً.</p>

      <div className="stat-grid">
        {stats.map(([l, v, warn]) => (
          <div className="stat" key={l}>
            <div className={"v" + (warn && v ? " warn" : "")}>{v}</div>
            <div className="l">{l}</div>
          </div>
        ))}
      </div>

      <div className="section-title">الأقسام</div>
      <div className="grid">
        {cards.map(([icon, t, d, href]) => (
          <Link key={href} href={href} className="mpcard">
            <div className="n">{icon} {t}</div>
            <div className="m">{d}</div>
          </Link>
        ))}
      </div>

      {s.pending > 0 && (
        <p className="muted" style={{ marginTop: 18 }}>
          🔔 لديك <b style={{ color: "#fb923c" }}>{s.pending}</b> تعليق بانتظار المراجعة —{" "}
          <Link href="/admin/comments">راجعها الآن</Link>
        </p>
      )}
    </div>
  );
}
