/**
 * Theme configuration defining the application's design system
 * Implements WCAG 2.1 AA compliant color schemes and typography
 * @version 1.0.0
 */

import { NOTIFICATION_TYPES } from '../constants/app.constants';
// @ts-ignore - Tailwind types issue
import defaultTheme from 'tailwindcss/defaultTheme'; // v3.3.0

/**
 * Main theme configuration object defining colors, typography,
 * spacing, breakpoints and other visual styling parameters
 */
export const theme = {
  colors: {
    // Primary color palette - Blue
    primary: {
      50: '#EFF6FF',  // Lightest shade
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#2563EB', // Base color
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A'  // Darkest shade
    },
    // Secondary color palette - Gray
    secondary: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B', // Base color
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A'
    },
    // Semantic colors for notifications and states
    success: '#10B981', // Green
    warning: '#F59E0B', // Amber
    error: '#EF4444',   // Red
    info: '#3B82F6'     // Blue
  },

  typography: {
    fontFamily: {
      // System font stack with Inter as primary font
      sans: [
        'Inter',
        '-apple-system',
        'system-ui',
        ...defaultTheme.fontFamily.sans
      ],
      // Monospace font stack for code and technical content
      mono: [
        'ui-monospace',
        'SFMono-Regular',
        'Menlo',
        'Monaco',
        'Consolas',
        ...defaultTheme.fontFamily.mono
      ]
    },
    // Font size scale with 1rem base
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem',// 30px
      '4xl': '2.25rem'  // 36px
    },
    // Font weight scale
    fontWeight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    }
  },

  // Spacing system based on 4px grid
  spacing: {
    base: '4px',
    1: '4px',
    2: '8px',
    4: '16px',
    6: '24px',
    8: '32px',
    12: '48px',
    16: '64px'
  },

  // Responsive breakpoints for mobile-first design
  breakpoints: {
    xs: '320px',  // Extra small devices
    sm: '640px',  // Small devices
    md: '768px',  // Medium devices
    lg: '1024px', // Large devices
    xl: '1280px'  // Extra large devices
  },

  // Border radius scale
  borderRadius: {
    none: '0',
    sm: '0.125rem',    // 2px
    DEFAULT: '0.25rem', // 4px
    md: '0.375rem',    // 6px
    lg: '0.5rem',      // 8px
    full: '9999px'     // Circular
  },

  // Box shadow definitions
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
  }
};

/**
 * Helper function to get the appropriate theme color for notifications
 * @param type - Notification type from NOTIFICATION_TYPES enum
 * @returns Corresponding color code from theme colors
 */
export const getNotificationColor = (type: string): string => {
  switch (type) {
    case NOTIFICATION_TYPES.SUCCESS:
      return theme.colors.success;
    case NOTIFICATION_TYPES.ERROR:
      return theme.colors.error;
    case NOTIFICATION_TYPES.WARNING:
      return theme.colors.warning;
    case NOTIFICATION_TYPES.INFO:
    default:
      return theme.colors.info;
  }
};