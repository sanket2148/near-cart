// Real address-book CRUD — first module built directly on the request-scoped
// client + RLS pattern the auth-hardening plan flagged as a good future
// candidate (plan/tasks/decisions.md, 2026-07-18), rather than a
// backend.server.ts + service-role client: `addresses_owner_all` already
// grants the owning user full select/insert/update/delete via `auth.uid()`,
// so there's no need for a privileged bypass here at all. authMiddleware's
// context.scopedClient enforces ownership by construction — a caller simply
// cannot see or touch another user's rows, the DB does it, not app code.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth-session/middleware";

export type Address = {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
  isDefault: boolean;
};

type AddressRow = {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  pincode: string;
  lat: number | string;
  lng: number | string;
  is_default: boolean;
};

function mapRow(row: AddressRow): Address {
  return {
    id: row.id,
    label: row.label,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    pincode: row.pincode,
    lat: Number(row.lat),
    lng: Number(row.lng),
    isDefault: row.is_default,
  };
}

export const listAddresses = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { data, error } = await context.scopedClient
      .from("addresses")
      .select("id, label, line1, line2, city, pincode, lat, lng, is_default")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  });

const AddressInput = z.object({
  label: z.string().trim().max(40).optional(),
  line1: z.string().trim().min(1),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1),
  pincode: z.string().trim().min(4).max(10),
  lat: z.number(),
  lng: z.number(),
});

export const addAddress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(AddressInput)
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.scopedClient
      .from("addresses")
      .insert({
        user_id: context.uid,
        label: data.label || null,
        line1: data.line1,
        line2: data.line2 || null,
        city: data.city,
        pincode: data.pincode,
        lat: data.lat,
        lng: data.lng,
        location: `SRID=4326;POINT(${data.lng} ${data.lat})`,
      })
      .select("id, label, line1, line2, city, pincode, lat, lng, is_default")
      .single();
    if (error) throw new Error(error.message);
    return mapRow(row);
  });

export const updateAddress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(AddressInput.extend({ id: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    const { error } = await context.scopedClient
      .from("addresses")
      .update({
        label: rest.label || null,
        line1: rest.line1,
        line2: rest.line2 || null,
        city: rest.city,
        pincode: rest.pincode,
        lat: rest.lat,
        lng: rest.lng,
        location: `SRID=4326;POINT(${rest.lng} ${rest.lat})`,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  });

export const deleteAddress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.scopedClient.from("addresses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
  });

export const setDefaultAddress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    // RLS scopes both statements to this user's own rows already; clearing
    // every row first (rather than a conditional) keeps this correct even if
    // an earlier bug ever left more than one row marked default.
    const { error: clearErr } = await context.scopedClient
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", context.uid);
    if (clearErr) throw new Error(clearErr.message);
    const { error } = await context.scopedClient
      .from("addresses")
      .update({ is_default: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
  });
