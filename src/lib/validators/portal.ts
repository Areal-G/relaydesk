import { z } from "zod";
import { emailSchema } from "./common";

const body = z.string().trim().min(1, "Message cannot be empty").max(10_000);

/** A customer opening a ticket on an organization's public support portal. */
export const portalTicketSchema = z.object({
  name: z.string().trim().min(1, "Your name is required").max(120),
  email: emailSchema,
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(200),
  description: body,
});
export type PortalTicketInput = z.infer<typeof portalTicketSchema>;

export const portalReplySchema = z.object({ body });

/**
 * Inbound email webhook payload. Most providers (Postmark, SendGrid, Mailgun)
 * can be mapped to this shape with a small adapter or their JSON templates.
 */
export const inboundEmailSchema = z.object({
  to: z.string().trim().max(320),
  from: emailSchema,
  fromName: z.string().trim().max(120).optional(),
  subject: z.string().trim().max(200).default(""),
  text: body,
});
export type InboundEmailInput = z.infer<typeof inboundEmailSchema>;
