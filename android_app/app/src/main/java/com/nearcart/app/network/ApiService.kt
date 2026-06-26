package com.nearcart.app.network

import com.nearcart.app.models.Category
import com.nearcart.app.models.Order
import com.nearcart.app.models.Product
import com.nearcart.app.models.Shop
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * NearCart backend contract. These endpoints mirror the data the web app
 * consumes. The backend is not live yet (the web app currently ships mock
 * data), so [com.nearcart.app.repository.NearCartRepository] falls back to
 * bundled mock data. Once the endpoints exist, the repository can switch to
 * this service with no UI changes.
 */
interface ApiService {

    @GET("categories")
    suspend fun getCategories(): List<Category>

    @GET("shops")
    suspend fun getShops(): List<Shop>

    @GET("shops/{shopId}")
    suspend fun getShop(@Path("shopId") shopId: String): Shop

    @GET("shops/{shopId}/products")
    suspend fun getProducts(@Path("shopId") shopId: String): List<Product>

    @GET("orders")
    suspend fun getOrders(): List<Order>

    @POST("orders")
    suspend fun placeOrder(@Body order: Order): Order
}
