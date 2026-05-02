import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { userTokens } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
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
  if (auth) {
    // Already has a token → skip dashboard, go to /skills
    if (from === "/dashboard") {
      const existingToken = await db
        .select({ id: userTokens.id })
        .from(userTokens)
        .where(and(eq(userTokens.userId, auth.userId), isNull(userTokens.revokedAt)))
        .limit(1);
      if (existingToken.length > 0) {
        redirect("/skills");
        return;
      }
    }
    redirect(from);
  }

  return <LoginForm />;
}
