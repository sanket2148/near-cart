package com.nearcart.app.repository

import com.nearcart.app.models.Category
import com.nearcart.app.models.Order
import com.nearcart.app.models.Product
import com.nearcart.app.models.Shop
import com.nearcart.app.network.ApiService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Single source of truth for catalog + order data. Tries the live backend
 * first and transparently falls back to bundled [MockData] when the API is
 * unavailable (the web app still ships mock data today). Swapping to the real
 * backend requires no UI/ViewModel changes.
 *
 * Orders are kept in memory for now, mirroring the web app's local order store.
 */
class NearCartRepository(
    private val api: ApiService,
    private val useRemote: Boolean = false,
) {
    private val localOrders = mutableListOf<Order>()

    suspend fun getCategories(): List<Category> = safe(MockData.categories) { api.getCategories() }

    suspend fun getShops(): List<Shop> = safe(MockData.shops) { api.getShops() }

    suspend fun getShop(shopId: String): Shop? =
        getShops().find { it.id == shopId }

    suspend fun getProducts(shopId: String): List<Product> =
        safe(MockData.products.filter { it.shopId == shopId }) { api.getProducts(shopId) }

    suspend fun getOrders(): List<Order> = localOrders.toList()

    suspend fun placeOrder(order: Order): Order {
        if (useRemote) {
            runCatching { api.placeOrder(order) }
                .onSuccess { localOrders.add(0, it); return it }
        }
        localOrders.add(0, order)
        return order
    }

    fun getOrder(id: String): Order? = localOrders.find { it.id == id }

    private suspend fun <T> safe(fallback: T, block: suspend () -> T): T =
        withContext(Dispatchers.IO) {
            if (!useRemote) fallback
            else runCatching { block() }.getOrDefault(fallback)
        }
}
