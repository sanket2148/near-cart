package com.nearcart.app.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import com.nearcart.app.ui.navigation.Routes

data class NavItem(val route: String, val label: String, val icon: ImageVector)

@Composable
fun NearCartBottomBar(
    currentRoute: String?,
    cartCount: Int,
    onNavigate: (String) -> Unit,
) {
    val items = listOf(
        NavItem(Routes.HOME, "Home", Icons.Outlined.Home),
        NavItem(Routes.SEARCH, "Search", Icons.Outlined.Search),
        NavItem(Routes.CART, "Cart", Icons.Outlined.ShoppingCart),
        NavItem(Routes.ORDERS, "Orders", Icons.Outlined.ReceiptLong),
    )
    NavigationBar {
        items.forEach { item ->
            NavigationBarItem(
                selected = currentRoute == item.route,
                onClick = { onNavigate(item.route) },
                icon = {
                    if (item.route == Routes.CART && cartCount > 0) {
                        BadgedBox(badge = { Badge { Text("$cartCount") } }) {
                            Icon(item.icon, contentDescription = item.label)
                        }
                    } else {
                        Icon(item.icon, contentDescription = item.label)
                    }
                },
                label = { Text(item.label) },
            )
        }
    }
}
