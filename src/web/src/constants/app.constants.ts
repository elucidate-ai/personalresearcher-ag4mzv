/**
 * Core application constants, enumerations, and configuration values
 * @version 1.0.0
 */

/**
 * Interface defining content quality score thresholds
 */
export interface IQualityThresholds {
  readonly MIN: number;
  readonly MAX: number;
  readonly DEFAULT: number;
}

/**
 * Interface defining responsive design breakpoints in pixels
 */
export interface IBreakpoints {
  readonly xs: number;  // Extra small devices
  readonly sm: number;  // Small devices
  readonly md: number;  // Medium devices
  readonly lg: number;  // Large devices
  readonly xl: number;  // Extra large devices
}

/**
 * Interface defining standard animation durations in milliseconds
 */
export interface IAnimationDuration {
  readonly fast: number;    // Quick transitions
  readonly normal: number;  // Standard transitions
  readonly slow: number;    // Elaborate animations
}

/**
 * Interface defining standard spacing values in pixels
 */
export interface ISpacing {
  readonly xs: number;   // Extra small spacing
  readonly sm: number;   // Small spacing
  readonly md: number;   // Medium spacing
  readonly lg: number;   // Large spacing
  readonly xl: number;   // Extra large spacing
  readonly xxl: number;  // Extra extra large spacing
}

/**
 * Interface defining all UI-related constants
 */
export interface IUIConstants {
  readonly BREAKPOINTS: IBreakpoints;
  readonly ANIMATION_DURATION: IAnimationDuration;
  readonly SPACING: ISpacing;
}

/**
 * Supported content types for content discovery and processing
 */
export enum CONTENT_TYPES {
  VIDEO = 'video',
  ARTICLE = 'article',
  PODCAST = 'podcast',
  BOOK = 'book'
}

/**
 * Supported export formats for document generation
 */
export enum EXPORT_FORMATS {
  NOTION = 'notion',
  MARKDOWN = 'markdown',
  PDF = 'pdf'
}

/**
 * Content quality score thresholds for content ranking
 */
export const QUALITY_THRESHOLDS: IQualityThresholds = {
  MIN: 0,      // Minimum acceptable quality score
  MAX: 100,    // Maximum possible quality score
  DEFAULT: 70  // Default quality threshold for content inclusion
} as const;

/**
 * UI-related constants for consistent styling and responsiveness
 */
export const UI_CONSTANTS: IUIConstants = {
  BREAKPOINTS: {
    xs: 320,  // Extra small devices (phones)
    sm: 640,  // Small devices (large phones/small tablets)
    md: 768,  // Medium devices (tablets)
    lg: 1024, // Large devices (desktops)
    xl: 1280  // Extra large devices (large desktops)
  },
  ANIMATION_DURATION: {
    fast: 200,    // Quick transitions (e.g., hover effects)
    normal: 300,  // Standard transitions (e.g., modals)
    slow: 500     // Elaborate animations (e.g., page transitions)
  },
  SPACING: {
    xs: 4,    // Extra small spacing (compact elements)
    sm: 8,    // Small spacing (related elements)
    md: 16,   // Medium spacing (component separation)
    lg: 24,   // Large spacing (section separation)
    xl: 32,   // Extra large spacing (major sections)
    xxl: 48   // Extra extra large spacing (page sections)
  }
} as const;