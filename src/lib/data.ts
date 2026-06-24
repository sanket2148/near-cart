// NearCart seed data (mock). Prices in INR. Replaceable with Lovable Cloud later.

export type Category = {
  id: string;
  name: string;
  emoji: string;
};

export type Product = {
  id: string;
  shopId: string;
  name: string;
  emoji: string;
  price: number; // INR
  mrp?: number;
  unit: string;
  category: string;
  inStock: boolean;
};

export type Shop = {
  id: string;
  name: string;
  category: string; // category id
  tagline: string;
  emoji: string;
  rating: number;
  ratingCount: number;
  distanceKm: number;
  etaMinutes: number;
  isOpen: boolean;
  deliveryFee: number;
  freeAbove: number;
  area: string;
  lat: number;
  lng: number;
};

export const categories: Category[] = [
  { id: "grocery", name: "Grocery", emoji: "🛒" },
  { id: "pharmacy", name: "Pharmacy", emoji: "💊" },
  { id: "bakery", name: "Bakery", emoji: "🥐" },
  { id: "hardware", name: "Hardware", emoji: "🔧" },
  { id: "stationery", name: "Stationery", emoji: "✏️" },
  { id: "electronics", name: "Electronics", emoji: "🔌" },
];

export const shops: Shop[] = [
  {
    id: "ramesh-stores",
    name: "Ramesh General Stores",
    category: "grocery",
    tagline: "30 years of trusted kirana",
    emoji: "🏪",
    rating: 4.6,
    ratingCount: 1240,
    distanceKm: 0.8,
    etaMinutes: 22,
    isOpen: true,
    deliveryFee: 25,
    freeAbove: 499,
    area: "Koramangala",
  },
  {
    id: "city-pharmacy",
    name: "CityCare Pharmacy",
    category: "pharmacy",
    tagline: "Medicines & wellness, fast",
    emoji: "⚕️",
    rating: 4.8,
    ratingCount: 860,
    distanceKm: 1.2,
    etaMinutes: 28,
    isOpen: true,
    deliveryFee: 20,
    freeAbove: 299,
    area: "Indiranagar",
  },
  {
    id: "sunrise-bakery",
    name: "Sunrise Bakery",
    category: "bakery",
    tagline: "Fresh baked every morning",
    emoji: "🍞",
    rating: 4.7,
    ratingCount: 540,
    distanceKm: 0.6,
    etaMinutes: 18,
    isOpen: true,
    deliveryFee: 30,
    freeAbove: 399,
    area: "Koramangala",
  },
  {
    id: "fixit-hardware",
    name: "FixIt Hardware",
    category: "hardware",
    tagline: "Tools, paint & plumbing",
    emoji: "🛠️",
    rating: 4.4,
    ratingCount: 320,
    distanceKm: 2.1,
    etaMinutes: 35,
    isOpen: true,
    deliveryFee: 40,
    freeAbove: 799,
    area: "HSR Layout",
  },
  {
    id: "scholars-stationery",
    name: "Scholars Stationery",
    category: "stationery",
    tagline: "Everything for school & office",
    emoji: "📚",
    rating: 4.5,
    ratingCount: 210,
    distanceKm: 1.5,
    etaMinutes: 30,
    isOpen: false,
    deliveryFee: 25,
    freeAbove: 349,
    area: "BTM Layout",
  },
  {
    id: "voltline-electronics",
    name: "VoltLine Electronics",
    category: "electronics",
    tagline: "Gadgets & accessories",
    emoji: "💡",
    rating: 4.3,
    ratingCount: 175,
    distanceKm: 2.8,
    etaMinutes: 40,
    isOpen: true,
    deliveryFee: 49,
    freeAbove: 999,
    area: "HSR Layout",
  },
];

export const products: Product[] = [
  // Ramesh General Stores
  { id: "p1", shopId: "ramesh-stores", name: "Aashirvaad Atta 5kg", emoji: "🌾", price: 280, mrp: 305, unit: "5 kg", category: "Staples", inStock: true },
  { id: "p2", shopId: "ramesh-stores", name: "Toor Dal", emoji: "🫘", price: 150, mrp: 170, unit: "1 kg", category: "Staples", inStock: true },
  { id: "p3", shopId: "ramesh-stores", name: "Amul Gold Milk", emoji: "🥛", price: 34, unit: "500 ml", category: "Dairy", inStock: true },
  { id: "p4", shopId: "ramesh-stores", name: "Fortune Sunflower Oil", emoji: "🛢️", price: 145, mrp: 160, unit: "1 L", category: "Staples", inStock: true },
  { id: "p5", shopId: "ramesh-stores", name: "Tata Salt", emoji: "🧂", price: 28, unit: "1 kg", category: "Staples", inStock: true },
  { id: "p6", shopId: "ramesh-stores", name: "Maggi Noodles", emoji: "🍜", price: 60, unit: "Pack of 4", category: "Snacks", inStock: true },
  { id: "p7", shopId: "ramesh-stores", name: "Farm Eggs", emoji: "🥚", price: 84, unit: "Tray of 12", category: "Dairy", inStock: true },
  { id: "p8", shopId: "ramesh-stores", name: "Britannia Bread", emoji: "🍞", price: 45, unit: "400 g", category: "Bakery", inStock: false },

  // CityCare Pharmacy
  { id: "p10", shopId: "city-pharmacy", name: "Paracetamol 500mg", emoji: "💊", price: 25, unit: "Strip of 10", category: "Medicine", inStock: true },
  { id: "p11", shopId: "city-pharmacy", name: "Dettol Antiseptic", emoji: "🧴", price: 95, mrp: 110, unit: "250 ml", category: "First Aid", inStock: true },
  { id: "p12", shopId: "city-pharmacy", name: "Vitamin C Tablets", emoji: "🍊", price: 180, unit: "Bottle of 60", category: "Wellness", inStock: true },
  { id: "p13", shopId: "city-pharmacy", name: "Digital Thermometer", emoji: "🌡️", price: 220, mrp: 299, unit: "1 pc", category: "Devices", inStock: true },
  { id: "p14", shopId: "city-pharmacy", name: "Hand Sanitizer", emoji: "🧼", price: 60, unit: "200 ml", category: "Hygiene", inStock: true },
  { id: "p15", shopId: "city-pharmacy", name: "Band-Aid Pack", emoji: "🩹", price: 45, unit: "Pack of 20", category: "First Aid", inStock: true },

  // Sunrise Bakery
  { id: "p20", shopId: "sunrise-bakery", name: "Butter Croissant", emoji: "🥐", price: 60, unit: "1 pc", category: "Baked", inStock: true },
  { id: "p21", shopId: "sunrise-bakery", name: "Chocolate Pastry", emoji: "🍫", price: 80, unit: "1 pc", category: "Baked", inStock: true },
  { id: "p22", shopId: "sunrise-bakery", name: "Whole Wheat Loaf", emoji: "🍞", price: 55, unit: "400 g", category: "Bread", inStock: true },
  { id: "p23", shopId: "sunrise-bakery", name: "Veg Puff", emoji: "🥟", price: 30, unit: "1 pc", category: "Savoury", inStock: true },
  { id: "p24", shopId: "sunrise-bakery", name: "Birthday Cake 1kg", emoji: "🎂", price: 650, mrp: 750, unit: "1 kg", category: "Cakes", inStock: true },
  { id: "p25", shopId: "sunrise-bakery", name: "Cookies Box", emoji: "🍪", price: 220, unit: "500 g", category: "Baked", inStock: true },

  // FixIt Hardware
  { id: "p30", shopId: "fixit-hardware", name: "Hammer", emoji: "🔨", price: 320, unit: "1 pc", category: "Tools", inStock: true },
  { id: "p31", shopId: "fixit-hardware", name: "Screwdriver Set", emoji: "🪛", price: 450, mrp: 520, unit: "6 pc set", category: "Tools", inStock: true },
  { id: "p32", shopId: "fixit-hardware", name: "Wall Paint 1L", emoji: "🎨", price: 380, unit: "1 L", category: "Paint", inStock: true },
  { id: "p33", shopId: "fixit-hardware", name: "LED Bulb 9W", emoji: "💡", price: 110, unit: "1 pc", category: "Electrical", inStock: true },
  { id: "p34", shopId: "fixit-hardware", name: "PVC Pipe 1m", emoji: "🪠", price: 90, unit: "1 m", category: "Plumbing", inStock: true },

  // Scholars Stationery
  { id: "p40", shopId: "scholars-stationery", name: "Classmate Notebook", emoji: "📓", price: 55, unit: "1 pc", category: "Notebooks", inStock: true },
  { id: "p41", shopId: "scholars-stationery", name: "Ball Pens Set", emoji: "🖊️", price: 50, unit: "Pack of 5", category: "Pens", inStock: true },
  { id: "p42", shopId: "scholars-stationery", name: "Geometry Box", emoji: "📐", price: 120, mrp: 150, unit: "1 set", category: "Tools", inStock: true },
  { id: "p43", shopId: "scholars-stationery", name: "A4 Paper Ream", emoji: "📄", price: 320, unit: "500 sheets", category: "Paper", inStock: true },

  // VoltLine Electronics
  { id: "p50", shopId: "voltline-electronics", name: "USB-C Cable", emoji: "🔌", price: 199, mrp: 299, unit: "1 m", category: "Cables", inStock: true },
  { id: "p51", shopId: "voltline-electronics", name: "Wireless Earbuds", emoji: "🎧", price: 1299, mrp: 1999, unit: "1 pair", category: "Audio", inStock: true },
  { id: "p52", shopId: "voltline-electronics", name: "Power Bank 10000mAh", emoji: "🔋", price: 899, mrp: 1199, unit: "1 pc", category: "Power", inStock: true },
  { id: "p53", shopId: "voltline-electronics", name: "AA Batteries", emoji: "🪫", price: 90, unit: "Pack of 4", category: "Power", inStock: true },
];

export function getShop(id: string): Shop | undefined {
  return shops.find((s) => s.id === id);
}

export function getProductsByShop(shopId: string): Product[] {
  return products.filter((p) => p.shopId === shopId);
}

export function getCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function formatINR(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}
