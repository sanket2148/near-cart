package com.nearcart.app.utils

import android.content.Context

/**
 * Lightweight session/token store. Reuses the web app's auth model: a bearer
 * token (JWT or Lovable Cloud session) is persisted and attached to API calls.
 * The web app currently uses open role-switching with mock data, so this is a
 * no-op container until real auth endpoints are wired up.
 */
class SessionManager(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences("nearcart_session", Context.MODE_PRIVATE)

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    val isLoggedIn: Boolean get() = token != null

    fun clear() = prefs.edit().clear().apply()

    companion object {
        private const val KEY_TOKEN = "auth_token"
    }
}
