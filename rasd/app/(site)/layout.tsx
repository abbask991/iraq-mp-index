// Public surface: landing + login.
// The landing supplies its own header (.lp-nav) and its own .lp container;
// login is a self-centering .card. Deliberately no shared topbar — the old
// global one showed a "دخول" link to already-logged-in users.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className="site-shell">{children}</div>;
}
