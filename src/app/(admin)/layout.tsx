import { SiteNav, SiteFooter } from "@/components/auf/SiteNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-density="dense"
      className="flex min-h-screen flex-col"
    >
      <SiteNav role="admin" />
      <main className="flex-1">{children}</main>
      <SiteFooter role="admin" />
    </div>
  );
}
