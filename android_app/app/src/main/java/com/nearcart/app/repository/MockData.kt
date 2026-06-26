package com.nearcart.app.repository

import com.nearcart.app.models.Category
import com.nearcart.app.models.Product
import com.nearcart.app.models.Shop

/**
 * Bundled mock data mirroring the web app's `src/lib/data.ts`. Used as a
 * fallback while the backend API is not yet live. Keep in sync with the web
 * seed data so both clients show the same catalog.
 */
object MockData {

    val categories = listOf(
        Category("grocery", "Grocery", "🛒"),
        Category("pharmacy", "Pharmacy", "💊"),
        Category("bakery", "Bakery", "🥐"),
        Category("hardware", "Hardware", "🔧"),
        Category("stationery", "Stationery", "✏️"),
        Category("electronics", "Electronics", "🔌"),
    )

    val shops = listOf(
        Shop("ramesh-stores", "Ramesh General Stores", "grocery", "30 years of trusted kirana", "🏪", 4.6, 1240, 0.8, 22, true, 25, 499, "Koramangala", 12.9352, 77.6245),
        Shop("city-pharmacy", "CityCare Pharmacy", "pharmacy", "Medicines & wellness, fast", "⚕️", 4.8, 860, 1.2, 28, true, 20, 299, "Indiranagar", 12.9719, 77.6412),
        Shop("sunrise-bakery", "Sunrise Bakery", "bakery", "Fresh baked every morning", "🍞", 4.7, 540, 0.6, 18, true, 30, 399, "Koramangala", 12.9300, 77.6280),
        Shop("fixit-hardware", "FixIt Hardware", "hardware", "Tools, paint & plumbing", "🛠️", 4.4, 320, 2.1, 35, true, 40, 799, "HSR Layout", 12.9116, 77.6389),
        Shop("scholars-stationery", "Scholars Stationery", "stationery", "Everything for school & office", "📚", 4.5, 210, 1.5, 30, false, 25, 349, "BTM Layout", 12.9166, 77.6101),
        Shop("voltline-electronics", "VoltLine Electronics", "electronics", "Gadgets & accessories", "💡", 4.3, 175, 2.8, 40, true, 49, 999, "HSR Layout", 12.9100, 77.6450),
    )

    val products = listOf(
        // Ramesh General Stores
        Product("p1", "ramesh-stores", "Aashirvaad Atta 5kg", "🌾", 280, 305, "5 kg", "Staples", true),
        Product("p2", "ramesh-stores", "Toor Dal", "🫘", 150, 170, "1 kg", "Staples", true),
        Product("p3", "ramesh-stores", "Amul Gold Milk", "🥛", 34, null, "500 ml", "Dairy", true),
        Product("p4", "ramesh-stores", "Fortune Sunflower Oil", "🛢️", 145, 160, "1 L", "Staples", true),
        Product("p5", "ramesh-stores", "Tata Salt", "🧂", 28, null, "1 kg", "Staples", true),
        Product("p6", "ramesh-stores", "Maggi Noodles", "🍜", 60, null, "Pack of 4", "Snacks", true),
        Product("p7", "ramesh-stores", "Farm Eggs", "🥚", 84, null, "Tray of 12", "Dairy", true),
        Product("p8", "ramesh-stores", "Britannia Bread", "🍞", 45, null, "400 g", "Bakery", false),
        // CityCare Pharmacy
        Product("p10", "city-pharmacy", "Paracetamol 500mg", "💊", 25, null, "Strip of 10", "Medicine", true),
        Product("p11", "city-pharmacy", "Dettol Antiseptic", "🧴", 95, 110, "250 ml", "First Aid", true),
        Product("p12", "city-pharmacy", "Vitamin C Tablets", "🍊", 180, null, "Bottle of 60", "Wellness", true),
        Product("p13", "city-pharmacy", "Digital Thermometer", "🌡️", 220, 299, "1 pc", "Devices", true),
        Product("p14", "city-pharmacy", "Hand Sanitizer", "🧼", 60, null, "200 ml", "Hygiene", true),
        Product("p15", "city-pharmacy", "Band-Aid Pack", "🩹", 45, null, "Pack of 20", "First Aid", true),
        // Sunrise Bakery
        Product("p20", "sunrise-bakery", "Butter Croissant", "🥐", 60, null, "1 pc", "Baked", true),
        Product("p21", "sunrise-bakery", "Chocolate Pastry", "🍫", 80, null, "1 pc", "Baked", true),
        Product("p22", "sunrise-bakery", "Whole Wheat Loaf", "🍞", 55, null, "400 g", "Bread", true),
        Product("p23", "sunrise-bakery", "Veg Puff", "🥟", 30, null, "1 pc", "Savoury", true),
        Product("p24", "sunrise-bakery", "Birthday Cake 1kg", "🎂", 650, 750, "1 kg", "Cakes", true),
        Product("p25", "sunrise-bakery", "Cookies Box", "🍪", 220, null, "500 g", "Baked", true),
        // FixIt Hardware
        Product("p30", "fixit-hardware", "Hammer", "🔨", 320, null, "1 pc", "Tools", true),
        Product("p31", "fixit-hardware", "Screwdriver Set", "🪛", 450, 520, "6 pc set", "Tools", true),
        Product("p32", "fixit-hardware", "Wall Paint 1L", "🎨", 380, null, "1 L", "Paint", true),
        Product("p33", "fixit-hardware", "LED Bulb 9W", "💡", 110, null, "1 pc", "Electrical", true),
        Product("p34", "fixit-hardware", "PVC Pipe 1m", "🪠", 90, null, "1 m", "Plumbing", true),
        // Scholars Stationery
        Product("p40", "scholars-stationery", "Classmate Notebook", "📓", 55, null, "1 pc", "Notebooks", true),
        Product("p41", "scholars-stationery", "Ball Pens Set", "🖊️", 50, null, "Pack of 5", "Pens", true),
        Product("p42", "scholars-stationery", "Geometry Box", "📐", 120, 150, "1 set", "Tools", true),
        Product("p43", "scholars-stationery", "A4 Paper Ream", "📄", 320, null, "500 sheets", "Paper", true),
        // VoltLine Electronics
        Product("p50", "voltline-electronics", "USB-C Cable", "🔌", 199, 299, "1 m", "Cables", true),
        Product("p51", "voltline-electronics", "Wireless Earbuds", "🎧", 1299, 1999, "1 pair", "Audio", true),
        Product("p52", "voltline-electronics", "Power Bank 10000mAh", "🔋", 899, 1199, "1 pc", "Power", true),
        Product("p53", "voltline-electronics", "AA Batteries", "🪫", 90, null, "Pack of 4", "Power", true),
    )
}
