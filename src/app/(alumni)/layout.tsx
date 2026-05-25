import { AlumniShell } from "@/components/auf/AlumniShell";

export default function AlumniLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AlumniShell>{children}</AlumniShell>;
}
