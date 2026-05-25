import { SiteNav, SiteFooter } from "@/components/auf/SiteNav";

export default function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-density="compact"
      className="flex min-h-screen flex-col"
    >
      <SiteNav role="employer" />
      <main className="flex-1">{children}</main>
      <SiteFooter role="employer" />
    </div>
  );
}
