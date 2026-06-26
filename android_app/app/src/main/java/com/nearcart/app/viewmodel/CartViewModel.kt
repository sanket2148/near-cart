package com.nearcart.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.nearcart.app.models.CartLine
import com.nearcart.app.models.Product
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Shared cart, scoped to the navigation graph so all screens see one cart.
 * Mirrors the web app's single-shop cart rule: adding an item from a
 * different shop replaces the current cart.
 */
class CartViewModel : ViewModel() {

    private val _lines = MutableStateFlow<List<CartLine>>(emptyList())
    val lines: StateFlow<List<CartLine>> = _lines.asStateFlow()

    private val _shopId = MutableStateFlow<String?>(null)
    val shopId: StateFlow<String?> = _shopId.asStateFlow()

    fun add(product: Product) {
        if (_shopId.value != null && _shopId.value != product.shopId) {
            // Different shop -> reset cart (single-shop rule)
            _lines.value = emptyList()
        }
        _shopId.value = product.shopId
        val current = _lines.value.toMutableList()
        val idx = current.indexOfFirst { it.product.id == product.id }
        if (idx >= 0) {
            current[idx] = current[idx].copy(quantity = current[idx].quantity + 1)
        } else {
            current.add(CartLine(product, 1))
        }
        _lines.value = current
    }

    fun decrement(productId: String) {
        val current = _lines.value.toMutableList()
        val idx = current.indexOfFirst { it.product.id == productId }
        if (idx < 0) return
        val line = current[idx]
        if (line.quantity <= 1) current.removeAt(idx)
        else current[idx] = line.copy(quantity = line.quantity - 1)
        _lines.value = current
        if (current.isEmpty()) _shopId.value = null
    }

    fun quantityOf(productId: String): Int =
        _lines.value.find { it.product.id == productId }?.quantity ?: 0

    fun clear() {
        _lines.value = emptyList()
        _shopId.value = null
    }

    val itemCount: Int get() = _lines.value.sumOf { it.quantity }
    val subtotal: Int get() = _lines.value.sumOf { it.product.price * it.quantity }

    class Factory : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = CartViewModel() as T
    }
}
