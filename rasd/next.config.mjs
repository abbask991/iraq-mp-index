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
      // corporate/report was the same endpoint as the dashboard — now its print view
      { source: "/monitor/corporate/report", destination: "/monitor/corporate", permanent: false },
    ];
  },
};
export default nextConfig;
