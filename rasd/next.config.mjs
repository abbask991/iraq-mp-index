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
      // Narratives & Battlefield — 4 tools folded into one tabbed module.
      { source: "/monitor/battlefield", destination: "/monitor/narratives?tab=battlefield", permanent: false },
      { source: "/monitor/regional-influence", destination: "/monitor/narratives?tab=regional", permanent: false },
      { source: "/monitor/cross-influence", destination: "/monitor/narratives?tab=cross-border", permanent: false },
      // Campaigns & Disinformation — 6 tools folded into one tabbed module.
      { source: "/monitor/campaign", destination: "/monitor/campaigns?tab=check", permanent: false },
      { source: "/monitor/coordination", destination: "/monitor/campaigns?tab=coordination", permanent: false },
      { source: "/monitor/disinfo", destination: "/monitor/campaigns?tab=disinfo", permanent: false },
      { source: "/monitor/visual-verification", destination: "/monitor/campaigns?tab=visual", permanent: false },
      { source: "/monitor/new-accounts", destination: "/monitor/campaigns?tab=new-accounts", permanent: false },
      { source: "/monitor/patient-zero", destination: "/monitor/campaigns?tab=patient-zero", permanent: false },
      // Risk & Early Warning — 5 tools folded into one tabbed module.
      { source: "/monitor/alerts", destination: "/monitor/risk?tab=alerts", permanent: false },
      { source: "/monitor/discover", destination: "/monitor/risk?tab=trends-now", permanent: false },
      { source: "/monitor/trends", destination: "/monitor/risk?tab=trend", permanent: false },
      { source: "/monitor/predictive", destination: "/monitor/risk?tab=forecast", permanent: false },
      { source: "/monitor/indices/public-anger", destination: "/monitor/risk?tab=anger", permanent: false },
      // Analysis Lab — 8 analytical tools folded into one tabbed module.
      { source: "/monitor/content", destination: "/monitor/analysis?tab=content", permanent: false },
      { source: "/monitor/sov", destination: "/monitor/analysis?tab=sov", permanent: false },
      { source: "/monitor/opinion", destination: "/monitor/analysis?tab=opinion", permanent: false },
      { source: "/monitor/polling", destination: "/monitor/analysis?tab=polling", permanent: false },
      { source: "/monitor/network", destination: "/monitor/analysis?tab=advanced", permanent: false },
      { source: "/monitor/research", destination: "/monitor/analysis?tab=studies", permanent: false },
      { source: "/monitor/index-report", destination: "/monitor/analysis?tab=kpis", permanent: false },
      { source: "/monitor/polls", destination: "/monitor/analysis?tab=polls", permanent: false },
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
