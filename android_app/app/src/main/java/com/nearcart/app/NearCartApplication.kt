package com.nearcart.app

import android.app.Application
import com.nearcart.app.network.RetrofitClient
import com.nearcart.app.repository.NearCartRepository
import com.nearcart.app.utils.SessionManager

/**
 * App-wide singletons (manual DI to keep the project dependency-light).
 * Access via (application as NearCartApplication).
 */
class NearCartApplication : Application() {

    lateinit var session: SessionManager
        private set
    lateinit var repository: NearCartRepository
        private set

    override fun onCreate() {
        super.onCreate()
        session = SessionManager(this)
        val api = RetrofitClient.create(session)
        // useRemote=false until the backend endpoints are live; flips to mock.
        repository = NearCartRepository(api, useRemote = false)
    }
}
