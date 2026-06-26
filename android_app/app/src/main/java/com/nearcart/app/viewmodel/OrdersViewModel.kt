package com.nearcart.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.nearcart.app.models.CartLine
import com.nearcart.app.models.Order
import com.nearcart.app.models.OrderLine
import com.nearcart.app.models.Shop
import com.nearcart.app.repository.NearCartRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.random.Random

class OrdersViewModel(private val repo: NearCartRepository) : ViewModel() {

    private val _orders = MutableStateFlow<List<Order>>(emptyList())
    val orders: StateFlow<List<Order>> = _orders.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch { _orders.value = repo.getOrders() }
    }

    fun getOrder(id: String): Order? = repo.getOrder(id)

    fun placeOrder(
        shop: Shop,
        lines: List<CartLine>,
        address: String,
        paymentMethod: String,
        onPlaced: (Order) -> Unit,
    ) {
        viewModelScope.launch {
            val subtotal = lines.sumOf { it.product.price * it.quantity }
            val deliveryFee = if (subtotal >= shop.freeAbove) 0 else shop.deliveryFee
            val handling = 7
            val order = Order(
                id = "NC" + (10_000_000 + Random.nextInt(89_999_999)),
                shopId = shop.id,
                shopName = shop.name,
                shopEmoji = shop.emoji,
                lines = lines.map {
                    OrderLine(it.product.name, it.product.emoji, it.product.price, it.product.unit, it.quantity)
                },
                subtotal = subtotal,
                deliveryFee = deliveryFee,
                handling = handling,
                total = subtotal + deliveryFee + handling,
                paymentMethod = paymentMethod,
                address = address,
                etaMinutes = shop.etaMinutes,
                placedAt = System.currentTimeMillis(),
            )
            val placed = repo.placeOrder(order)
            refresh()
            onPlaced(placed)
        }
    }

    class Factory(private val repo: NearCartRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            OrdersViewModel(repo) as T
    }
}
