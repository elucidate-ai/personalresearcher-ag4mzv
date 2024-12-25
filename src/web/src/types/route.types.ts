/**
 * @fileoverview Type definitions for application routing system
 * Provides comprehensive type safety for routes, authentication, and authorization
 * @version 1.0.0
 */

import { RouteProps } from 'react-router-dom'; // ^6.16.0
import { ROUTES, ROUTE_PARAMS } from '../constants/route.constants';

/**
 * User roles for route authorization
 * Maps directly to authorization matrix from security specifications
 */
export type UserRole = 'ANONYMOUS' | 'BASIC_USER' | 'PREMIUM_USER' | 'CONTENT_MANAGER' | 'ADMINISTRATOR';

/**
 * Route parameter types for dynamic routes
 * Ensures type safety when working with URL parameters
 */
export type RouteParams = {
  [ROUTE_PARAMS.TOPIC_ID]: string;
  [ROUTE_PARAMS.CONTENT_ID]: string;
};

/**
 * Application route configuration type
 * Defines structure for route definitions with role-based access control
 */
export type AppRoute = {
  path: keyof typeof ROUTES;
  component: React.ComponentType<any>;
  isPrivate: boolean;
  roles: ReadonlyArray<UserRole>;
  meta?: {
    title: string;
    breadcrumb?: string;
    menuSection?: 'main' | 'topic';
  };
};

/**
 * Props interface for protected routes
 * Used by PrivateRoute component to enforce authentication and authorization
 */
export interface PrivateRouteProps extends Omit<RouteProps, 'component'> {
  component: React.ComponentType<any>;
  roles: ReadonlyArray<UserRole>;
}

/**
 * Props interface for public routes
 * Used by PublicRoute component to handle public access and restrictions
 */
export interface PublicRouteProps extends Omit<RouteProps, 'component'> {
  component: React.ComponentType<any>;
  restricted?: boolean; // If true, authenticated users will be redirected away
}

/**
 * Navigation item type for menu structure
 * Supports hierarchical navigation defined in UI specifications
 */
export type NavigationItem = {
  path: keyof typeof ROUTES;
  label: string;
  icon?: string;
  children?: NavigationItem[];
  requiredRole?: UserRole;
};

/**
 * Route location state type
 * Defines type-safe structure for additional state in route navigation
 */
export interface RouteLocationState {
  from?: string;
  searchQuery?: string;
  filters?: {
    contentType?: string[];
    dateRange?: [Date, Date];
    quality?: number;
  };
}

/**
 * Breadcrumb route type
 * Supports breadcrumb navigation in layout structure
 */
export type BreadcrumbRoute = {
  path: keyof typeof ROUTES;
  breadcrumb: string | ((params: RouteParams) => string);
  parent?: keyof typeof ROUTES;
};

/**
 * Route guard type
 * Defines structure for route access validation functions
 */
export type RouteGuard = {
  canActivate: (userRole: UserRole) => boolean;
  redirectTo: keyof typeof ROUTES;
};

/**
 * Route transition type
 * Supports route transition animations in layout structure
 */
export type RouteTransition = {
  enter: string;
  exit: string;
  duration: number;
};

/**
 * Route metadata type
 * Additional route configuration for enhanced functionality
 */
export type RouteMeta = {
  title: string;
  description?: string;
  preload?: boolean;
  transition?: RouteTransition;
  guard?: RouteGuard;
};

/**
 * Route error boundary type
 * Defines error handling behavior for routes
 */
export interface RouteErrorBoundary {
  fallback: React.ComponentType<any>;
  onError?: (error: Error) => void;
}