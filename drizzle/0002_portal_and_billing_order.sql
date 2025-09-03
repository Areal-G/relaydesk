ALTER TABLE "organizations" ADD COLUMN "billing_event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "customer_token_hash" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_token_hash_unique" UNIQUE("customer_token_hash");