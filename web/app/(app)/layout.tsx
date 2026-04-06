import { getAuthFromCookies } from "@/lib/auth";
import Nav from "./Nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuthFromCookies();

  return (
    <>
      {/* Shared nav for authenticated pages */}
      <Nav auth={auth} />
      {children}
    </>
  );
}
