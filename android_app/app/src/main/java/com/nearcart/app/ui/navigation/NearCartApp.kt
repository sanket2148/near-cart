package com.nearcart.app.ui.navigation

import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.padding
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.nearcart.app.NearCartApplication
import com.nearcart.app.ui.components.NearCartBottomBar
import com.nearcart.app.ui.screens.*
import com.nearcart.app.viewmodel.CartViewModel
import com.nearcart.app.viewmodel.HomeViewModel
import com.nearcart.app.viewmodel.OrdersViewModel
import com.nearcart.app.viewmodel.ShopViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NearCartApp(app: NearCartApplication) {
    val navController = rememberNavController()
    val repo = app.repository

    // Graph-scoped shared ViewModels.
    val homeVm: HomeViewModel = viewModel(factory = HomeViewModel.Factory(repo))
    val cartVm: CartViewModel = viewModel(factory = CartViewModel.Factory())
    val ordersVm: OrdersViewModel = viewModel(factory = OrdersViewModel.Factory(repo))

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    Scaffold(
        topBar = {
            if (currentRoute in Routes.bottomBarRoutes) {
                TopAppBar(title = { Text(titleFor(currentRoute)) })
            }
        },
        bottomBar = {
            if (currentRoute in Routes.bottomBarRoutes) {
                NearCartBottomBar(
                    currentRoute = currentRoute,
                    cartCount = cartVm.itemCount,
                    onNavigate = { route ->
                        navController.navigate(route) {
                            popUpTo(Routes.HOME)
                            launchSingleTop = true
                        }
                    },
                )
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Routes.HOME,
            modifier = Modifier.padding(padding),
        ) {
            composable(Routes.HOME) {
                HomeScreen(
                    vm = homeVm,
                    onShopClick = { navController.navigate(Routes.shop(it)) },
                    onSearchClick = { navController.navigate(Routes.SEARCH) },
                )
            }
            composable(Routes.SEARCH) {
                SearchScreen(vm = homeVm, onShopClick = { navController.navigate(Routes.shop(it)) })
            }
            composable(Routes.CART) {
                CartScreen(
                    cartVm = cartVm,
                    homeVm = homeVm,
                    ordersVm = ordersVm,
                    onBack = { navController.popBackStack() },
                    onBrowse = { navController.navigate(Routes.HOME) },
                    onPlaced = { orderId ->
                        navController.navigate(Routes.orderDetail(orderId)) {
                            popUpTo(Routes.HOME)
                        }
                    },
                )
            }
            composable(Routes.ORDERS) {
                OrdersScreen(ordersVm = ordersVm, onOrderClick = { navController.navigate(Routes.orderDetail(it)) })
            }
            composable(
                Routes.SHOP,
                arguments = listOf(navArgument("shopId") { type = NavType.StringType }),
            ) { entry ->
                val shopId = entry.arguments?.getString("shopId").orEmpty()
                val shopVm: ShopViewModel = viewModel(factory = ShopViewModel.Factory(repo))
                ShopScreen(
                    shopId = shopId,
                    vm = shopVm,
                    cartVm = cartVm,
                    onBack = { navController.popBackStack() },
                    onViewCart = { navController.navigate(Routes.CART) },
                )
            }
            composable(
                Routes.ORDER_DETAIL,
                arguments = listOf(navArgument("orderId") { type = NavType.StringType }),
            ) { entry ->
                val orderId = entry.arguments?.getString("orderId").orEmpty()
                OrderDetailScreen(orderId = orderId, ordersVm = ordersVm, onBack = { navController.popBackStack() })
            }
        }
    }
}

private fun titleFor(route: String?): String = when (route) {
    Routes.HOME -> "NearCart"
    Routes.SEARCH -> "Search"
    Routes.CART -> "Cart"
    Routes.ORDERS -> "My Orders"
    else -> "NearCart"
}
