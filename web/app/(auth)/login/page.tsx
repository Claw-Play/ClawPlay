import { redirect } from "next/navigation";
import { getAuthFromCookies } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  // Server-side redirect if already logged in — no flash of login page
  const auth = await getAuthFromCookies();
  if (auth) redirect("/dashboard");

  return <LoginForm />;
}
