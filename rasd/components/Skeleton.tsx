// Shimmer loading placeholders — premium SaaS feel while data loads.
export function Skel({ w = "100%", h = 16, r = 8, mb = 0 }:
  { w?: number | string; h?: number; r?: number; mb?: number }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r, marginBottom: mb }} />;
}

// A ready-made "loading dashboard" block: a few skeleton cards.
export function SkelCards({ count = 4 }: { count?: number }) {
  return (
    <div>
      <div className="skel" style={{ height: 90, borderRadius: 16, marginBottom: 14 }} />
      <div className="grid">
        {Array.from({ length: count }).map((_, i) => (
          <div className="card" key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skel w={90} h={12} />
            <Skel w="60%" h={26} />
            <Skel h={8} />
          </div>
        ))}
      </div>
    </div>
  );
}
