// Real saved-products list — same request-scoped + RLS pattern as
// addresses/notifications/profile. Requires supabase/migrations/0007_wishlist.sql
// to have been run (wishlists table + wishlists_owner_all RLS policy); see
// plan/tasks/decisions.md, 2026-07-18.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth-session/middleware";

export type WishlistProduct = {
  wishlistId: string;
  productId: string;
  name: string;
  emoji: string | null;
  priceAmount: number;
  mrpAmount: number | null;
  unit: string | null;
  inStock: boolean;
  shopId: string;
  shopName: string;
};

type WishlistRow = {
  id: string;
  product_id: string;
  products: {
    id: string;
    name: string;
    emoji: string | null;
    price_amount: number;
    mrp_amount: number | null;
    unit: string | null;
    in_stock: boolean;
    shop_id: string;
    shops: { id: string; name: string } | null;
  } | null;
};

export const listWishlist = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { data, error } = await context.scopedClient
      .from("wishlists")
      .select(
        "id, product_id, products(id, name, emoji, price_amount, mrp_amount, unit, in_stock, shop_id, shops(id, name))",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as WishlistRow[])
      .filter((row): row is WishlistRow & { products: NonNullable<WishlistRow["products"]> } =>
        Boolean(row.products),
      )
      .map((row): WishlistProduct => ({
        wishlistId: row.id,
        productId: row.products.id,
        name: row.products.name,
        emoji: row.products.emoji,
        priceAmount: row.products.price_amount,
        mrpAmount: row.products.mrp_amount,
        unit: row.products.unit,
        inStock: row.products.in_stock,
        shopId: row.products.shop_id,
        shopName: row.products.shops?.name ?? "",
      }));
  });

export const isWishlisted = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ productId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.scopedClient
      .from("wishlists")
      .select("id")
      .eq("product_id", data.productId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { wishlisted: Boolean(row) };
  });

export const addToWishlist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ productId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.scopedClient
      .from("wishlists")
      .insert({ user_id: context.uid, product_id: data.productId });
    if (error && !error.message.includes("duplicate key")) throw new Error(error.message);
  });

export const removeFromWishlist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ productId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.scopedClient
      .from("wishlists")
      .delete()
      .eq("product_id", data.productId);
    if (error) throw new Error(error.message);
  });
