package com.nearcart.app.models

import com.google.gson.annotations.SerializedName

/**
 * Domain models for NearCart. Field names mirror the web app's data shape
 * (see web `src/lib/data.ts`) so the same backend JSON maps directly.
 */

data class Category(
    val id: String,
    val name: String,
    val emoji: String,
)

data class Shop(
    val id: String,
    val name: String,
    val category: String,
    val tagline: String,
    val emoji: String,
    val rating: Double,
    @SerializedName("ratingCount") val ratingCount: Int,
    @SerializedName("distanceKm") val distanceKm: Double,
    @SerializedName("etaMinutes") val etaMinutes: Int,
    @SerializedName("isOpen") val isOpen: Boolean,
    @SerializedName("deliveryFee") val deliveryFee: Int,
    @SerializedName("freeAbove") val freeAbove: Int,
    val area: String,
    val lat: Double,
    val lng: Double,
)

data class Product(
    val id: String,
    @SerializedName("shopId") val shopId: String,
    val name: String,
    val emoji: String,
    val price: Int,
    val mrp: Int? = null,
    val unit: String,
    val category: String,
    @SerializedName("inStock") val inStock: Boolean,
)

data class CartLine(
    val product: Product,
    val quantity: Int,
)

data class OrderLine(
    val name: String,
    val emoji: String,
    val price: Int,
    val unit: String,
    val quantity: Int,
)

enum class OrderStatus {
    @SerializedName("placed") PLACED,
    @SerializedName("accepted") ACCEPTED,
    @SerializedName("preparing") PREPARING,
    @SerializedName("out_for_delivery") OUT_FOR_DELIVERY,
    @SerializedName("delivered") DELIVERED,
}

data class Order(
    val id: String,
    val shopId: String,
    val shopName: String,
    val shopEmoji: String,
    val lines: List<OrderLine>,
    val subtotal: Int,
    val deliveryFee: Int,
    val handling: Int,
    val total: Int,
    val paymentMethod: String,
    val address: String,
    val etaMinutes: Int,
    val placedAt: Long,
    val status: OrderStatus = OrderStatus.PLACED,
)
