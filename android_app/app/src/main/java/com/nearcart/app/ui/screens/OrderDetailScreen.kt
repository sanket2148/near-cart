package com.nearcart.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.background
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nearcart.app.models.OrderStatus
import com.nearcart.app.utils.formatINR
import com.nearcart.app.viewmodel.OrdersViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderDetailScreen(
    orderId: String,
    ordersVm: OrdersViewModel,
    onBack: () -> Unit,
) {
    val order = ordersVm.getOrder(orderId)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Order #$orderId") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                },
            )
        },
    ) { padding ->
        if (order == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("Order not found")
            }
            return@Scaffold
        }
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp)) {
            item {
                Text("${order.shopEmoji} ${order.shopName}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Arriving in ~${order.etaMinutes} min", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(16.dp))
            }
            item {
                val steps = listOf(
                    OrderStatus.PLACED to "Order Placed",
                    OrderStatus.ACCEPTED to "Accepted",
                    OrderStatus.PREPARING to "Preparing / Ready",
                    OrderStatus.OUT_FOR_DELIVERY to "Out for Delivery",
                    OrderStatus.DELIVERED to "Delivered",
                )
                val currentIdx = steps.indexOfFirst { it.first == order.status }
                Column {
                    steps.forEachIndexed { idx, (_, label) ->
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 6.dp)) {
                            Box(
                                modifier = Modifier.size(20.dp).clip(CircleShape)
                                    .background(if (idx <= currentIdx) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant),
                            )
                            Spacer(Modifier.width(12.dp))
                            Text(label, fontWeight = if (idx == currentIdx) FontWeight.Bold else FontWeight.Normal)
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
                HorizontalDivider()
            }
            item {
                Spacer(Modifier.height(12.dp))
                Text("Items", fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                order.lines.forEach { line ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(line.emoji, fontSize = 20.sp)
                        Spacer(Modifier.width(8.dp))
                        Text("${line.name}  ×${line.quantity}", modifier = Modifier.weight(1f))
                        Text(formatINR(line.price * line.quantity))
                    }
                }
                Spacer(Modifier.height(12.dp))
                HorizontalDivider()
                Spacer(Modifier.height(12.dp))
                Row(Modifier.fillMaxWidth()) {
                    Text("Total", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold)
                    Text(formatINR(order.total), fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(8.dp))
                Text("Paid via ${order.paymentMethod}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Deliver to: ${order.address}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
