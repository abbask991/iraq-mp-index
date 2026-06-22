"use client";
import { useEffect, useState } from "react";
import { supabase, MP } from "@/lib/supabaseClient";
import { hasQuorum, bayesianAverage, QUORUM } from "@/lib/scoreGate";
import RatingForm from "@/components/RatingForm";
import Comments from "@/components/Comments";

export default function MPPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [mp, setMp] = useState<MP | null>(null);
  const [stat, setStat] = useState<{ n_ratings: number; avg_stars: number } | null>(null);

  async function loadStat() {
    const { data } = await supabase.from("mp_rating_stats").select("*").eq("mp_id", id).maybeSingle();
    setStat(data ?? { n_ratings: 0, avg_stars: 0 });
  }
  useEffect(() => {
    supabase.from("mps").select("*").eq("id", id).maybeSingle().then(({ data }) => setMp(data));
    loadStat();
  }, [id]);

  if (!mp) return <p className="muted">جارٍ التحميل…</p>;

  const n = stat?.n_ratings ?? 0;
  const community = hasQuorum(n) ? bayesianAverage(n, stat!.avg_stars).toFixed(2) : null;

  return (
    <div>
      <a href="/" className="muted">← رجوع للقائمة</a>
      <h1 style={{ marginBottom: 4 }}>{mp.name}</h1>
      <p className="muted">{mp.role} · {mp.governorate} · {mp.bloc} · لجنة {mp.committee}</p>

      <div className="card" style={{ margin: "16px 0" }}>
        <b>تقييم الجمهور</b>
        {community ? (
          <p>⭐ {community} / 5 <span className="muted">(من {n} تقييم)</span></p>
        ) : (
          <p className="muted">عدد التقييمات ({n}) أقل من الحد الأدنى ({QUORUM}) — لا يُعرض متوسط بعد.</p>
        )}
        <p className="muted" style={{ fontSize: 12 }}>
          هذا التقييم للعرض فقط ولا يدخل في الدرجة الرسمية (المرحلة 1).
        </p>
      </div>

      <RatingForm mpId={id} onRated={loadStat} />
      <Comments mpId={id} />
    </div>
  );
}
