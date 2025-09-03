import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell title="Sign in to your workspace" subtitle="Use your work email and password.">
      <LoginForm showDemoAccounts={process.env.NEXT_PUBLIC_DEMO_MODE !== "false"} />
      <p className="text-center text-sm text-slate-500">
        New to Relaydesk?{" "}
        <Link href="/signup" className="font-medium text-brand-700 hover:underline">
          Create a workspace
        </Link>
      </p>
    </AuthShell>
  );
}
