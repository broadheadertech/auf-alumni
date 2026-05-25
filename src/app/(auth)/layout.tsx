/**
 * The AuthShell component owns the full-viewport split layout, so this
 * route-group wrapper just passes children through.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
