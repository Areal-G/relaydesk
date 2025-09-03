"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signupSchema } from "@/lib/validators/auth";
import { startSession } from "@/server/auth/session";
import { registerOrganization } from "@/server/auth/signup";
import { getDb } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { clientIp } from "@/server/http";
import { rateLimiters } from "@/server/rate-limit";

export interface SignupState {
  error?: string;
  values?: { name: string; email: string; orgName: string };
}

export async function signupAction(_previous: SignupState, formData: FormData): Promise<SignupState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    orgName: String(formData.get("orgName") ?? ""),
  };
  const parsed = signupSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again", values };
  }

  try {
    const ip = clientIp(await headers());
    if (ip) rateLimiters.signup.enforce(`signup-ip:${ip}`);
    rateLimiters.signup.enforce(`signup:${parsed.data.email}`);
    const actor = await registerOrganization(await getDb(), parsed.data);
    await startSession(actor);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message, values };
    throw error;
  }
  redirect("/dashboard");
}
