package com.nearcart.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.nearcart.app.models.Category
import com.nearcart.app.models.Shop
import com.nearcart.app.repository.NearCartRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HomeUiState(
    val loading: Boolean = true,
    val categories: List<Category> = emptyList(),
    val shops: List<Shop> = emptyList(),
    val query: String = "",
)

class HomeViewModel(private val repo: NearCartRepository) : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true)
            val categories = repo.getCategories()
            val shops = repo.getShops()
            _state.value = _state.value.copy(loading = false, categories = categories, shops = shops)
        }
    }

    fun onQueryChange(q: String) {
        _state.value = _state.value.copy(query = q)
    }

    fun filteredShops(): List<Shop> {
        val q = _state.value.query.trim().lowercase()
        if (q.isEmpty()) return _state.value.shops
        return _state.value.shops.filter {
            it.name.lowercase().contains(q) ||
                it.category.lowercase().contains(q) ||
                it.area.lowercase().contains(q)
        }
    }

    class Factory(private val repo: NearCartRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            HomeViewModel(repo) as T
    }
}
