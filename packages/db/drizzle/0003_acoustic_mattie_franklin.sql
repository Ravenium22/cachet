CREATE TYPE "public"."crypto_payment_status" AS ENUM('pending', 'submitted', 'verifying', 'confirmed', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_chain" AS ENUM('ethereum', 'base', 'arbitrum');--> statement-breakpoint
CREATE TYPE "public"."payment_token" AS ENUM('usdc', 'usdt');--> statement-breakpoint
CREATE TABLE "crypto_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"tier" "subscription_tier" NOT NULL,
	"billing_period" varchar(10) NOT NULL,
	"amount_usd_cents" integer NOT NULL,
	"token" "payment_token" NOT NULL,
	"chain" "payment_chain" NOT NULL,
	"recipient_address" varchar(42) NOT NULL,
	"amount_token" varchar(78) NOT NULL,
	"tx_hash" varchar(66),
	"sender_address" varchar(42),
	"status" "crypto_payment_status" DEFAULT 'pending' NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "role_mappings" ADD COLUMN "order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "crypto_payments" ADD CONSTRAINT "crypto_payments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crypto_payments_project_id_idx" ON "crypto_payments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "crypto_payments_status_idx" ON "crypto_payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "crypto_payments_tx_hash_unique" ON "crypto_payments" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "crypto_payments_expires_at_idx" ON "crypto_payments" USING btree ("expires_at");