package com.nearcart.app.utils

import java.text.NumberFormat
import java.util.Locale

/** Formats an amount as Indian Rupees, e.g. 1499 -> "₹1,499". */
fun formatINR(amount: Int): String {
    val nf = NumberFormat.getNumberInstance(Locale("en", "IN"))
    return "₹" + nf.format(amount)
}
