package com.nearcart.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nearcart.app.models.Product
import com.nearcart.app.utils.formatINR

@Composable
fun ProductRow(
    product: Product,
    quantity: Int,
    onAdd: () -> Unit,
    onRemove: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) { Text(product.emoji, fontSize = 26.sp) }

        Spacer(Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(product.name, style = MaterialTheme.typography.titleMedium)
            Text(product.unit, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(formatINR(product.price), fontWeight = FontWeight.SemiBold)
                product.mrp?.let {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        formatINR(it),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textDecoration = TextDecoration.LineThrough,
                    )
                }
            }
        }

        if (!product.inStock) {
            AssistChip(onClick = {}, enabled = false, label = { Text("Out of stock") })
        } else if (quantity == 0) {
            OutlinedButton(onClick = onAdd, shape = RoundedCornerShape(10.dp)) { Text("ADD") }
        } else {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(MaterialTheme.colorScheme.primary),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                QtyBtn(Icons.Filled.Remove, onRemove)
                Text("$quantity", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 10.dp))
                QtyBtn(Icons.Filled.Add, onAdd)
            }
        }
    }
}

@Composable
private fun QtyBtn(icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    IconButton(onClick = onClick, modifier = Modifier.size(36.dp)) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(18.dp))
    }
}
