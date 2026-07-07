import { StyleSheet } from 'react-native';

export const theme = {
  colors: {
    primary: '#259F56',       // NearCart Green
    primaryLight: '#DCFCE7',  // Soft Green
    accent: '#F3821D',        // NearCart Amber Orange
    accentLight: '#FFEDD5',    // Soft Orange
    background: '#FBFCF8',    // Warm off-white
    surface: '#FFFFFF',       // Pure white
    border: '#E2E8F0',        // Light gray
    textDark: '#0D1F16',      // Deep forest green
    textMuted: '#64748B',     // Slate gray
    textLight: '#94A3B8',     // Light slate gray
    destructive: '#EF4444',   // Red
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    badge: 8,
    button: 12,
    card: 18,
    avatar: 16,
  },
};

export const commonStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  btnPrimary: {
    height: 48,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.badge,
    gap: 4,
  },
});
