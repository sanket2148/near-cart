package com.nearcart.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.nearcart.app.ui.navigation.NearCartApp
import com.nearcart.app.ui.theme.NearCartTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as NearCartApplication
        setContent {
            NearCartTheme {
                NearCartApp(app)
            }
        }
    }
}
