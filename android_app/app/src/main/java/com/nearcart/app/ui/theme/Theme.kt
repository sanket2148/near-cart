package com.nearcart.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = NcPrimary,
    onPrimary = Color.White,
    primaryContainer = NcSecondary,
    onPrimaryContainer = NcForeground,
    secondary = NcAccent,
    onSecondary = Color.White,
    background = NcBackground,
    onBackground = NcForeground,
    surface = NcCard,
    onSurface = NcForeground,
    surfaceVariant = NcMuted,
    onSurfaceVariant = NcMutedForeground,
    outline = NcBorder,
    error = NcDestructive,
    onError = Color.White,
)

private val DarkColors = darkColorScheme(
    primary = NcDarkPrimary,
    onPrimary = Color.White,
    primaryContainer = NcDarkCard,
    onPrimaryContainer = NcDarkForeground,
    secondary = NcAccent,
    onSecondary = Color.White,
    background = NcDarkBackground,
    onBackground = NcDarkForeground,
    surface = NcDarkCard,
    onSurface = NcDarkForeground,
    surfaceVariant = NcDarkCard,
    onSurfaceVariant = NcDarkMutedForeground,
    outline = Color(0xFF24332A),
    error = NcDestructive,
    onError = Color.White,
)

@Composable
fun NearCartTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = NearCartTypography,
        content = content,
    )
}
