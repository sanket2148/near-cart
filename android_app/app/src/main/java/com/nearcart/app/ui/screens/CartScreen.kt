package com.nearcart.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nearcart.app.utils.formatINR
import com.nearcart.app.viewmodel.CartViewModel
import com.nearcart.app.viewmodel.HomeViewModel
import com.nearcart.app.viewmodel.OrdersViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CartScreen(
    cartVm: CartViewModel,
    homeVm: HomeViewModel,
    ordersVm: OrdersViewModel,
    onBack: () -> Unit,
    onBrowse: () -> Unit,
    onPlaced: (String) -> Unit,
) {
    val lines by cartVm.lines.collectAsState()
    val shopId by cartVm.shopId.collectAsState()
    val homeState by homeVm.state.collectAsState()
    val shop = remember(shopId, homeState.shops) { homeState.shops.find { it.id == shopId } }

    var address by remember { mutableStateOf("12, 5th Block, Koramangala, Bengaluru") }
    var payment by remember { mutableStateOf("Cash on Delivery") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Your Cart") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                },
            )
        },
    ) { padding ->
        if (lines.isEmpty() || shop == null) {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("🛒", fontSize = 48.sp)
                Spacer(Modifier.height(12.dp))
                Text("Your cart is empty", style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.height(8.dp))
                Button(onClick = onBrowse) { Text("Browse shops") }
            }
            return@Scaffold
        }

        val deliveryFee = if (cartVm.subtotal >= shop.freeAbove) 0 else shop.deliveryFee
        val handling = 7
        val total = cartVm.subtotal + deliveryFee + handling

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Text("From ${shop.emoji} ${shop.name}", fontWeight = FontWeight.SemiBold)
            }
            items(lines) { line ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(line.product.emoji, fontSize = 24.sp)
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(line.product.name, style = MaterialTheme.typography.bodyLarge)
                        Text(formatINR(line.product.price) + " · " + line.product.unit, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    IconButton(onClick = { cartVm.decrement(line.product.id) }) { Icon(Icons.Filled.Remove, contentDescription = "Remove") }
                    Text("${line.quantity}", fontWeight = FontWeight.Bold)
                    IconButton(onClick = { cartVm.add(line.product) }) { Icon(Icons.Filled.Add, contentDescription = "Add") }
                }
            }
            item { HorizontalDivider() }
            item {
                OutlinedTextField(
                    value = address,
                    onValueChange = { address = it },
                    label = { Text("Delivery address") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
            }
            item {
                Text("Payment method", fontWeight = FontWeight.SemiBold)
                listOf("Cash on Delivery", "UPI", "Card").forEach { method ->
                    Row(
                        modifier = Modifier.fillMaxWidth().selectable(selected = payment == method, onClick = { payment = method }).padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = payment == method, onClick = { payment = method })
                        Text(method)
                    }
                }
            }
            item { HorizontalDivider() }
            item { PriceRow("Subtotal", cartVm.subtotal) }
            item { PriceRow("Delivery fee", deliveryFee) }
            item { PriceRow("Handling", handling) }
            item {
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Text("Total", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Text(formatINR(total), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                }
            }
            item {
                Button(
                    onClick = {
                        ordersVm.placeOrder(shop, lines, address, payment) { order ->
                            cartVm.clear()
                            onPlaced(order.id)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Place Order  •  ${formatINR(total)}") }
            }
        }
    }
}

@Composable
private fun PriceRow(label: String, amount: Int) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Text(label, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(if (amount == 0) "FREE" else formatINR(amount))
    }
}
