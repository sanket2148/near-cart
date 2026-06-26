package com.nearcart.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nearcart.app.utils.formatINR
import com.nearcart.app.viewmodel.OrdersViewModel

@Composable
fun OrdersScreen(
    ordersVm: OrdersViewModel,
    onOrderClick: (String) -> Unit,
) {
    val orders by ordersVm.orders.collectAsState()

    if (orders.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("📦", fontSize = 48.sp)
                Spacer(Modifier.height(8.dp))
                Text("No orders yet", style = MaterialTheme.typography.titleLarge)
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(orders) { order ->
            Card(
                modifier = Modifier.fillMaxWidth().clickable { onOrderClick(order.id) },
                shape = RoundedCornerShape(16.dp),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(order.shopEmoji, fontSize = 26.sp)
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(order.shopName, fontWeight = FontWeight.SemiBold)
                            Text("#${order.id}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        AssistChip(onClick = {}, label = { Text(order.status.name.replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() }) })
                    }
                    Spacer(Modifier.height(8.dp))
                    Text("${order.lines.sumOf { it.quantity }} item(s)  •  ${formatINR(order.total)}", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}
