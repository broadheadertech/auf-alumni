import { EmployerShell } from "@/components/auf/EmployerShell";

export default function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmployerShell>{children}</EmployerShell>;
}
