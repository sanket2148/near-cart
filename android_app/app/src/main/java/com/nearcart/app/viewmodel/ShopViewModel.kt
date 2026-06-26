package com.nearcart.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.nearcart.app.models.Product
import com.nearcart.app.models.Shop
import com.nearcart.app.repository.NearCartRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ShopUiState(
    val loading: Boolean = true,
    val shop: Shop? = null,
    val products: List<Product> = emptyList(),
)

class ShopViewModel(private val repo: NearCartRepository) : ViewModel() {

    private val _state = MutableStateFlow(ShopUiState())
    val state: StateFlow<ShopUiState> = _state.asStateFlow()

    fun load(shopId: String) {
        viewModelScope.launch {
            _state.value = ShopUiState(loading = true)
            val shop = repo.getShop(shopId)
            val products = repo.getProducts(shopId)
            _state.value = ShopUiState(loading = false, shop = shop, products = products)
        }
    }

    class Factory(private val repo: NearCartRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            ShopViewModel(repo) as T
    }
}
