// Real profile read/update — same request-scoped + RLS pattern as
// addresses/notifications. `users_select_own`/`users_update_own` already
// grant the owning user full self-access via auth.uid(). Email is
// deliberately read-only here: it's the Supabase Auth identity itself
// (verified via OTP), not a free-text profile field — changing it needs
// Supabase's own re-verification flow, out of scope for a settings form.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth-session/middleware";

export type Profile = { id: string; email: string; fullName: string | null };

export const getProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { data, error } = await context.scopedClient
      .from("users")
      .select("id, email, full_name")
      .eq("id", context.uid)
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id, email: data.email, fullName: data.full_name } satisfies Profile;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ fullName: z.string().trim().max(80) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.scopedClient
      .from("users")
      .update({ full_name: data.fullName || null, updated_at: new Date().toISOString() })
      .eq("id", context.uid);
    if (error) throw new Error(error.message);
  });
