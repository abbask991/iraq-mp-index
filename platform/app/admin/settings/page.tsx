"use client";
import { useEffect, useState } from "react";
import { getSetting, setSetting } from "@/lib/admin";
import ListEditor from "@/components/ListEditor";

export default function AdminSettings() {
  const [sources, setSources] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getSetting("news_sources").then(setSources);
    getSetting("news_keywords").then(setKeywords);
    getSetting("news_hashtags").then(setHashtags);
  }, []);

  async function save() {
    setMsg("جارٍ الحفظ…");
    const e1 = await setSetting("news_sources", sources);
    const e2 = await setSetting("news_keywords", keywords);
    const e3 = await setSetting("news_hashtags", hashtags);
    setMsg(e1 || e2 || e3 ? `خطأ: ${e1 || e2 || e3}` : "✅ تم الحفظ");
  }

  return (
    <div>
      <h2>إعدادات الأخبار</h2>
      <p className="muted">تتحكّم بمصادر الأخبار والكلمات والهاشتاغات المرصودة.</p>
      <ListEditor title="📰 مصادر الأخبار (نطاقات المواقع)" placeholder="مثال: almada.iq"
        items={sources} onChange={setSources} />
      <ListEditor title="🔑 كلمات/سياق البحث" placeholder='مثال: "مجلس النواب"'
        items={keywords} onChange={setKeywords} />
      <ListEditor title="#️⃣ هاشتاغات/مواضيع مرصودة" placeholder="مثال: فساد مجلس النواب"
        items={hashtags} onChange={setHashtags} />
      <button className="btn" onClick={save}>حفظ الإعدادات</button>
      {msg && <span className="muted" style={{ marginRight: 12 }}>{msg}</span>}
    </div>
  );
}
