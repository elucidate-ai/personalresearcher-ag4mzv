/**
 * @fileoverview Route constants for the knowledge aggregation system
 * Defines all application routes and route parameters for consistent navigation
 * and type-safe routing throughout the application.
 * @version 1.0.0
 */

/**
 * Application route paths
 * Defines constant values for all navigable routes in the application
 * Used for consistent route definition and type-safe navigation
 */
export const ROUTES = {
  // Public routes accessible to all users
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',

  // Protected routes requiring authentication
  DASHBOARD: '/dashboard',
  SEARCH: '/search',
  
  // Dynamic routes with URL parameters
  TOPIC: '/topic/:topicId',      // Topic exploration view
  CONTENT: '/content/:contentId', // Individual content view
  GRAPH: '/graph/:topicId',      // Knowledge graph visualization
  EXPORT: '/export/:topicId'     // Content export interface
} as const;

/**
 * URL parameter names for dynamic routes
 * Used to ensure consistent parameter naming across the application
 * when working with dynamic route segments
 */
export const ROUTE_PARAMS = {
  TOPIC_ID: 'topicId',   // Parameter for topic-specific routes
  CONTENT_ID: 'contentId' // Parameter for content-specific routes
} as const;

/**
 * Type definitions for route paths and parameters
 * Enables TypeScript type checking for route usage
 */
export type RoutePath = typeof ROUTES[keyof typeof ROUTES];
export type RouteParam = typeof ROUTE_PARAMS[keyof typeof ROUTE_PARAMS];

/**
 * Helper type for extracting route parameters from path
 * Useful for type-safe parameter handling in components
 */
export type RouteParams<T extends RoutePath> = T extends `${string}:${infer Param}`
  ? { [K in Param]: string }
  : never;

/**
 * Helper function to generate complete route paths with parameters
 * @param route - Base route path from ROUTES
 * @param params - Object containing parameter values
 * @returns Complete route path with parameters replaced
 */
export const generatePath = <T extends RoutePath>(
  route: T,
  params?: RouteParams<T>
): string => {
  if (!params) return route;
  
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, value),
    route
  );
};

/**
 * Route groups for authorization control
 * Maps routes to required authorization levels
 */
export const ROUTE_AUTH_LEVELS = {
  PUBLIC: [ROUTES.HOME, ROUTES.LOGIN, ROUTES.REGISTER],
  BASIC_USER: [ROUTES.DASHBOARD, ROUTES.SEARCH],
  PREMIUM_USER: [ROUTES.TOPIC, ROUTES.CONTENT, ROUTES.GRAPH],
  ADMIN: [ROUTES.EXPORT]
} as const;

/**
 * Navigation menu structure
 * Defines the hierarchical organization of routes for menu generation
 */
export const ROUTE_MENU_STRUCTURE = {
  main: [
    { path: ROUTES.DASHBOARD, label: 'Dashboard' },
    { path: ROUTES.SEARCH, label: 'Search' }
  ],
  topic: [
    { path: ROUTES.TOPIC, label: 'Topic Details' },
    { path: ROUTES.GRAPH, label: 'Knowledge Graph' },
    { path: ROUTES.EXPORT, label: 'Export' }
  ]
} as const;