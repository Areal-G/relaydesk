import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create a workspace" };

const free = PLAN_DEFINITIONS.free;

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your agency workspace"
      subtitle={`Start on the Free plan: up to ${free.seats} team members and ${free.aiRequestsPerMonth} AI assists a month.`}
    >
      <SignupForm />
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
