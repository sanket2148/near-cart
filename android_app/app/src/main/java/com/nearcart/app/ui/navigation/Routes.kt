package com.nearcart.app.ui.navigation

object Routes {
    const val HOME = "home"
    const val SEARCH = "search"
    const val CART = "cart"
    const val ORDERS = "orders"
    const val SHOP = "shop/{shopId}"
    const val ORDER_DETAIL = "order/{orderId}"

    fun shop(shopId: String) = "shop/$shopId"
    fun orderDetail(orderId: String) = "order/$orderId"

    val bottomBarRoutes = setOf(HOME, SEARCH, CART, ORDERS)
}
