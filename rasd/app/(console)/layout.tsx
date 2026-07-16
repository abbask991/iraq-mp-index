// Console surface: the signed-in app (monitor + admin).
// .console replaces the old global .wrap (max-width:1000px) that squeezed the
// whole product into ~704px of usable content on a 1440px screen.
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <div className="console">{children}</div>;
}
