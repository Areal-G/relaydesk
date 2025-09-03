import { z } from "zod";
import { emailSchema, uuidSchema } from "./common";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(200),
  /** Optional: pick an organization when the user belongs to several. */
  orgId: uuidSchema.optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Your name is required").max(120),
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  orgName: z.string().trim().min(2, "Agency name must be at least 2 characters").max(80),
});

export type SignupInput = z.infer<typeof signupSchema>;
