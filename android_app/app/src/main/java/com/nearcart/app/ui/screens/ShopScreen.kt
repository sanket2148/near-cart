package com.nearcart.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nearcart.app.ui.components.ProductRow
import com.nearcart.app.ui.theme.NcWarning
import com.nearcart.app.utils.formatINR
import com.nearcart.app.viewmodel.CartViewModel
import com.nearcart.app.viewmodel.ShopViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopScreen(
    shopId: String,
    vm: ShopViewModel,
    cartVm: CartViewModel,
    onBack: () -> Unit,
    onViewCart: () -> Unit,
) {
    LaunchedEffect(shopId) { vm.load(shopId) }
    val state by vm.state.collectAsState()
    val cartLines by cartVm.lines.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.shop?.name ?: "Shop") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
        bottomBar = {
            if (cartVm.itemCount > 0) {
                Surface(color = MaterialTheme.colorScheme.primary, onClick = onViewCart) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(18.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "${cartVm.itemCount} item(s)  •  ${formatINR(cartVm.subtotal)}",
                            color = MaterialTheme.colorScheme.onPrimary,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f),
                        )
                        Text("View Cart  →", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold)
                    }
                }
            }
        },
    ) { padding ->
        if (state.loading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp)) {
            state.shop?.let { shop ->
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(shop.emoji, fontSize = 40.sp)
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(shop.tagline, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.height(4.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.Star, contentDescription = null, tint = NcWarning, modifier = Modifier.size(16.dp))
                                Text(" ${shop.rating} (${shop.ratingCount})  •  ${shop.etaMinutes} min", style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    val deliveryNote = if (shop.deliveryFee == 0) "Free delivery"
                    else "${formatINR(shop.deliveryFee)} delivery · Free above ${formatINR(shop.freeAbove)}"
                    AssistChip(onClick = {}, label = { Text(deliveryNote) })
                    Spacer(Modifier.height(8.dp))
                    HorizontalDivider()
                }
            }
            items(state.products) { product ->
                ProductRow(
                    product = product,
                    quantity = cartLines.find { it.product.id == product.id }?.quantity ?: 0,
                    onAdd = { cartVm.add(product) },
                    onRemove = { cartVm.decrement(product.id) },
                )
                HorizontalDivider()
            }
        }
    }
}
