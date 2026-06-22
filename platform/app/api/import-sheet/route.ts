import { NextRequest, NextResponse } from "next/server";

// Convert any Google Sheets share/edit URL to its CSV export URL.
function csvUrl(url: string): string | null {
  const m = url.match(/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const gid = url.match(/[#&?]gid=([0-9]+)/)?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
}

// Server-side proxy so the browser can read the sheet without CORS issues.
// The sheet must be shared "anyone with the link can view".
export async function POST(req: NextRequest) {
  const { url } = await req.json().catch(() => ({}));
  const target = csvUrl(url || "");
  if (!target) return NextResponse.json({ error: "رابط Google Sheet غير صالح" }, { status: 400 });
  const res = await fetch(target, { redirect: "follow" });
  if (!res.ok) return NextResponse.json({ error: "تعذّر جلب الجدول (تأكد أنه عام)" }, { status: 400 });
  return NextResponse.json({ csv: await res.text() });
}
