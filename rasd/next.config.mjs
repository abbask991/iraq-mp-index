/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // Consolidation redirects. Old routes that were merged into another page keep
  // working (bookmarks, the sidebar during rollout). 307 = temporary and
  // reversible on purpose: a merge that turns out wrong can be undone without
  // browsers having cached a permanent redirect. Flip to permanent only once the
  // new IA is settled.
  async redirects() {
    return [
      // overview showed the same ~10 items as command in older styling; its one
      // unique piece (Iraq geo map) moved into command.
      { source: "/monitor/overview", destination: "/monitor/command", permanent: false },
      // what-changed is a section of the command center (with a period switch now).
      { source: "/monitor/changes", destination: "/monitor/command", permanent: false },
      // brief + dossier are both printable deliverables → one Reports page, two tabs.
      { source: "/monitor/brief", destination: "/monitor/reports?tab=daily", permanent: false },
      { source: "/monitor/dossier", destination: "/monitor/reports?tab=full", permanent: false },
      // corporate/report was the same endpoint as the dashboard — now its print view
      { source: "/monitor/corporate/report", destination: "/monitor/corporate", permanent: false },
      // 9 corporate sub-pages → tabs over one brand. Old routes land on their tab.
      { source: "/monitor/corporate/reputation", destination: "/monitor/corporate?tab=reputation", permanent: false },
      { source: "/monitor/corporate/reviews", destination: "/monitor/corporate?tab=reviews", permanent: false },
      { source: "/monitor/corporate/complaints", destination: "/monitor/corporate?tab=complaints", permanent: false },
      { source: "/monitor/corporate/products", destination: "/monitor/corporate?tab=products", permanent: false },
      { source: "/monitor/corporate/competitors", destination: "/monitor/corporate?tab=competitors", permanent: false },
      { source: "/monitor/corporate/risk-index", destination: "/monitor/corporate?tab=risk-index", permanent: false },
      { source: "/monitor/corporate/fraud", destination: "/monitor/corporate?tab=fraud", permanent: false },
      { source: "/monitor/corporate/crisis", destination: "/monitor/corporate?tab=crisis", permanent: false },
      { source: "/monitor/corporate/response", destination: "/monitor/corporate?tab=response", permanent: false },
    ];
  },
};
export default nextConfig;
