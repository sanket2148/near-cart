// Real barcode → product lookup for seller product onboarding (see
// plan/tasks/decisions.md, 2026-07-25). Uses Open Food Facts
// (world.openfoodfacts.org) — a free, keyless, genuinely public product
// database with real Indian FMCG coverage, not a fabricated catalog or a
// paid API this project has no account for. Coverage is food/grocery-first;
// a miss just means the merchant fills the form in manually, same as today.

export type BarcodeLookupResult = {
  name: string;
  unit: string;
  category: string;
  imageUrl?: string;
};

const LOOKUP_TIMEOUT_MS = 6000;

function firstCategory(offCategories: string | undefined): string {
  if (!offCategories) return "";
  // Open Food Facts categories are a comma-separated hierarchy, often
  // "en:some-category, en:more-specific-category" — the last (most
  // specific) segment, with its locale prefix stripped, is the most useful
  // single category label.
  const parts = offCategories.split(",").map((c) => c.trim());
  const last = parts[parts.length - 1] ?? "";
  return last
    .replace(/^[a-z]{2}:/, "")
    .replace(/-/g, " ")
    .trim();
}

export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
      { signal: controller.signal, headers: { "User-Agent": "NearCart/1.0 (seller onboarding)" } },
    );
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    if (body.status !== 1 || !body.product) return null;

    const p = body.product;
    const name: string | undefined = p.product_name || p.product_name_en || p.generic_name;
    if (!name) return null;

    return {
      name,
      unit: p.quantity || "",
      category: firstCategory(p.categories),
      imageUrl: p.image_front_small_url || p.image_url || undefined,
    };
  } catch {
    // Timeout, network error, malformed response — a lookup miss, not a
    // failure the merchant should see as an error; they just fill it in.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
