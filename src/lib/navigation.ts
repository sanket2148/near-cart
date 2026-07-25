import {
  Home,
  Search,
  Grid,
  ClipboardList,
  ShoppingBag,
  MapPin,
  Percent,
  HelpCircle,
  Settings,
  Info,
  LogOut,
  Heart,
  Bell,
  CreditCard,
  User,
  ShieldCheck,
  Store,
  Bike,
} from "lucide-react";
import type { ComponentType } from "react";
import { categories, type Category } from "./data";

export type app_role = "customer" | "shop_owner" | "delivery_partner" | "admin";

export type NavigationItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  path: string;
  roles?: app_role[];
  badgeKey?: "cart" | "orders" | "notifications";
  isCategory?: boolean;
};

export const MENU_SECTIONS: {
  title: string;
  items: NavigationItem[];
}[] = [
  {
    title: "Core",
    items: [
      { id: "home", label: "Home", icon: Home, path: "/" },
      { id: "search", label: "Search", icon: Search, path: "/search" },
      { id: "orders", label: "My Orders", icon: ClipboardList, path: "/orders", badgeKey: "orders" },
      { id: "cart", label: "Cart", icon: ShoppingBag, path: "/cart", badgeKey: "cart" },
    ],
  },
  {
    title: "Account & Offers",
    items: [
      { id: "offers", label: "Offers & Coupons", icon: Percent, path: "/offers" },
      { id: "notifications", label: "Notifications", icon: Bell, path: "/notifications", badgeKey: "notifications" },
      { id: "wishlist", label: "Wishlist", icon: Heart, path: "/wishlist" },
      { id: "addresses", label: "Saved Addresses", icon: MapPin, path: "/addresses" },
      { id: "payments", label: "Payment Methods", icon: CreditCard, path: "/payments" },
    ],
  },
  {
    title: "Sell & Deliver",
    items: [
      { id: "seller-onboarding", label: "Add Your Shop", icon: Store, path: "/seller" },
      {
        id: "partner-onboarding",
        label: "Become a Delivery Partner",
        icon: Bike,
        path: "/partner",
      },
    ],
  },
  {
    title: "Support & Settings",
    items: [
      { id: "help", label: "Help & Support", icon: HelpCircle, path: "/help" },
      { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
      { id: "about", label: "About Us", icon: Info, path: "/about" },
    ],
  },
];

/**
 * Dynamically converts product categories from database seed into navigation sub-items
 */
export function getDynamicCategoryMenu(): NavigationItem[] {
  const categoryIcons: Record<string, any> = {
    grocery: ShoppingBag,
    pharmacy: ShieldCheck,
    bakery: Grid,
    hardware: Settings,
    stationery: Info,
    electronics: Settings,
  };

  return categories.map((cat) => ({
    id: `cat-${cat.id}`,
    label: cat.name,
    icon: categoryIcons[cat.id] || Grid,
    path: `/category/${cat.id}`,
    isCategory: true,
  }));
}
