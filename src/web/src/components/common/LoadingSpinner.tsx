import React from 'react'; // ^18.0.0
import '../../assets/styles/global.css';
import '../../assets/styles/tailwind.css';

/**
 * Props interface for the LoadingSpinner component
 */
interface LoadingSpinnerProps {
  /**
   * Size of the spinner - 'small' (16px) | 'medium' (24px) | 'large' (32px)
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * Color of the spinner using design system tokens
   * @default 'primary'
   */
  color?: 'primary' | 'secondary';
  
  /**
   * Additional CSS classes for custom styling
   */
  className?: string;
}

/**
 * A customizable loading spinner component with animation and accessibility support.
 * Implements the design system's loading state patterns with smooth animations.
 *
 * @component
 * @example
 * ```tsx
 * // Default medium primary spinner
 * <LoadingSpinner />
 * 
 * // Small secondary spinner
 * <LoadingSpinner size="small" color="secondary" />
 * 
 * // Large primary spinner with custom class
 * <LoadingSpinner size="large" className="my-4" />
 * ```
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'primary',
  className = '',
}) => {
  // Size mappings based on design system specifications
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8',
  };

  // Color mappings using CSS variables from global.css
  const colorClasses = {
    primary: 'text-[rgb(var(--color-primary))]',
    secondary: 'text-[rgb(var(--color-secondary))]',
  };

  // Combine all classes with proper fallbacks
  const spinnerClasses = [
    'inline-block',
    'animate-spin',
    sizeClasses[size],
    colorClasses[color],
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center justify-center"
    >
      <svg
        className={spinnerClasses}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        style={{
          willChange: 'transform',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">Loading</span>
    </div>
  );
};

// Export the component for use across the application
export default LoadingSpinner;

// Named exports for specific use cases
export type { LoadingSpinnerProps };