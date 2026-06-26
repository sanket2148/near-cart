package com.nearcart.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Typography. The web app uses "Plus Jakarta Sans". To match it exactly,
 * drop the font files into res/font and build a FontFamily; until then we use
 * the platform sans-serif with matching weights/scale.
 */
private val AppFontFamily = FontFamily.SansSerif

val NearCartTypography = Typography(
    headlineLarge = TextStyle(fontFamily = AppFontFamily, fontWeight = FontWeight.Bold, fontSize = 28.sp),
    headlineMedium = TextStyle(fontFamily = AppFontFamily, fontWeight = FontWeight.Bold, fontSize = 22.sp),
    titleLarge = TextStyle(fontFamily = AppFontFamily, fontWeight = FontWeight.SemiBold, fontSize = 18.sp),
    titleMedium = TextStyle(fontFamily = AppFontFamily, fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
    bodyLarge = TextStyle(fontFamily = AppFontFamily, fontWeight = FontWeight.Normal, fontSize = 16.sp),
    bodyMedium = TextStyle(fontFamily = AppFontFamily, fontWeight = FontWeight.Normal, fontSize = 14.sp),
    bodySmall = TextStyle(fontFamily = AppFontFamily, fontWeight = FontWeight.Normal, fontSize = 12.sp),
    labelLarge = TextStyle(fontFamily = AppFontFamily, fontWeight = FontWeight.SemiBold, fontSize = 14.sp),
    labelMedium = TextStyle(fontFamily = AppFontFamily, fontWeight = FontWeight.Medium, fontSize = 12.sp),
)
