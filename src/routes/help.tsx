import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help & Support — NearCart" }] }),
  component: HelpPage,
});

const FAQS = [
  {
    q: "How fast is delivery?",
    a: "Most orders arrive within 20–40 minutes, depending on the shop's estimated time shown on its page and how far you are from it. You can track your delivery partner's live location once your order is out for delivery.",
  },
  {
    q: "What payment methods do you accept?",
    a: "UPI, credit/debit cards, netbanking, and cash on delivery — choose whichever you like at checkout. Card and bank details are handled directly by Razorpay's secure checkout; NearCart never stores them.",
  },
  {
    q: "Can I cancel or change my order after placing it?",
    a: "Once a shop has accepted your order, it usually can't be changed. If something's wrong, contact us using the details below as soon as possible and we'll help sort it out with the shop.",
  },
  {
    q: "What if an item is missing or damaged?",
    a: "Reach out to us via email or phone with your order number and we'll follow up with the shop on your behalf.",
  },
  {
    q: "How do I become a seller on NearCart?",
    a: 'Tap "Sell on NearCart" from the home screen, or visit /sell — you\'ll go through a quick shop setup and verification flow before you can start listing products.',
  },
  {
    q: "How do I become a delivery partner?",
    a: "Open the app's Partner section and register with your vehicle details. Once approved, you'll start seeing nearby delivery jobs you can accept.",
  },
  {
    q: "Is my personal information safe?",
    a: "Yes — login is via a one-time code sent to your email, and we never ask for passwords. Payment details are handled entirely by Razorpay, not stored by NearCart.",
  },
];

function HelpPage() {
  return (
    <AppShell>
      <h1 className="text-xl font-extrabold">Help & Support</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Answers to common questions, and how to reach us for anything else.
      </p>

      <section className="mt-4 rounded-2xl border border-border bg-card p-2 shadow-card">
        <Accordion type="single" collapsible>
          {FAQS.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border/60 px-2">
              <AccordionTrigger className="text-left text-sm font-bold">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="mt-5 space-y-2.5">
        <h2 className="text-sm font-bold text-muted-foreground">Still need help?</h2>
        <a
          href="mailto:support@nearcart.app"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card transition-shadow hover:shadow-float"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block text-sm font-bold">Email us</span>
            <span className="text-xs text-muted-foreground">support@nearcart.app</span>
          </span>
        </a>
        <a
          href="tel:+911800000000"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card transition-shadow hover:shadow-float"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Phone className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block text-sm font-bold">Call us</span>
            <span className="text-xs text-muted-foreground">1800-000-000 (9am–9pm, every day)</span>
          </span>
        </a>
        <a
          href="mailto:support@nearcart.app?subject=Order%20issue"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card transition-shadow hover:shadow-float"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageCircle className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block text-sm font-bold">Report an order issue</span>
            <span className="text-xs text-muted-foreground">
              Include your order number for a faster reply
            </span>
          </span>
        </a>
      </section>
    </AppShell>
  );
}
