-- Keep IF NOT EXISTS: the migrator creates this schema for its log before it runs this file.
CREATE SCHEMA IF NOT EXISTS "game_service";
--> statement-breakpoint
CREATE TABLE "game_service"."flags" (
	"world_id" text NOT NULL,
	"student_id" text NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "flags_world_id_student_id_pk" PRIMARY KEY("world_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "game_service"."world_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "game_service"."worlds" (
	"id" text PRIMARY KEY NOT NULL,
	"live_version_id" uuid
);
--> statement-breakpoint
ALTER TABLE "game_service"."world_versions" ADD CONSTRAINT "world_versions_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "game_service"."worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_service"."worlds" ADD CONSTRAINT "worlds_live_version_id_world_versions_id_fk" FOREIGN KEY ("live_version_id") REFERENCES "game_service"."world_versions"("id") ON DELETE no action ON UPDATE no action;