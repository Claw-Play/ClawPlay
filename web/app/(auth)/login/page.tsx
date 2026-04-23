import { redirect } from "next/navigation";
import { getAuthFromCookies } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

function getSafeRedirectPath(value?: string): string | null {
  if (!value || !value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string }>;
}) {
  // Server-side redirect if already logged in — no flash of login page
  const auth = await getAuthFromCookies();
  const resolvedSearchParams = await searchParams;
  const from = getSafeRedirectPath(resolvedSearchParams?.from) ?? "/dashboard";
  if (auth) redirect(from);

  return <LoginForm />;
}
