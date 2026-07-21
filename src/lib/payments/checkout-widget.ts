// Thin wrapper around Razorpay's Checkout.js widget (client-side, safe to
// import from route components — no `.server` suffix). UNVERIFIED against a
// live gateway, since there are no test keys yet (see plan/tasks/decisions.md).
// Follows Razorpay's documented integration exactly; the widget's JS API has
// been stable for years, but this hasn't been exercised end-to-end.

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { contact?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
};

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Not in a browser"));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SCRIPT_SRC;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Could not load the payment widget. Check your connection."));
    document.body.appendChild(el);
  });
  return scriptPromise;
}

export async function openRazorpayCheckout(input: {
  keyId: string;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  shopName: string;
  contact?: string;
  email?: string;
  onSuccess: (result: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) => void;
  onDismiss: () => void;
}): Promise<void> {
  await loadScript();
  if (!window.Razorpay) throw new Error("Payment widget failed to load.");

  const prefill = input.contact || input.email ? { contact: input.contact, email: input.email } : undefined;

  const rzp = new window.Razorpay({
    key: input.keyId,
    amount: input.amount,
    currency: input.currency,
    name: "NearCart",
    description: `Order from ${input.shopName}`,
    order_id: input.razorpayOrderId,
    prefill,
    theme: { color: "#16a34a" },
    handler: (response) => {
      input.onSuccess({
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      });
    },
    modal: { ondismiss: input.onDismiss },
  });
  rzp.open();
}
