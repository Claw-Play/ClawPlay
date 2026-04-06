import { redirect } from "next/navigation";
import { getAuthFromCookies } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  // Server-side redirect if already logged in — no flash of register page
  const auth = await getAuthFromCookies();
  if (auth) redirect("/dashboard");

  return <RegisterForm />;
}
