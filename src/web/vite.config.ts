// @vitejs/plugin-react v4.0.0
// vite v4.4.0
// path (node:path)

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  // Configure React plugin with optimized settings for production
  plugins: [
    react({
      // Enable fast refresh for enhanced development experience
      fastRefresh: true,
      // Use automatic JSX runtime for optimal bundle size
      jsxRuntime: 'automatic',
      // Babel configuration for production optimization
      babel: {
        // Enable plugins for production builds
        plugins: [
          process.env.NODE_ENV === 'production' && [
            'babel-plugin-transform-remove-console',
            { exclude: ['error', 'warn'] }
          ]
        ].filter(Boolean)
      }
    })
  ],

  // Module resolution configuration
  resolve: {
    // Comprehensive path aliases for modular architecture
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@services': resolve(__dirname, 'src/services'),
      '@store': resolve(__dirname, 'src/store'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
      '@config': resolve(__dirname, 'src/config'),
      '@constants': resolve(__dirname, 'src/constants'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@lib': resolve(__dirname, 'src/lib')
    }
  },

  // Development server configuration
  server: {
    // Default development port
    port: 3000,
    // Ensure strict port usage
    strictPort: true,
    // Enable network access for team development
    host: true,
    // Enable CORS for API integration
    cors: true,
    // Security headers for development
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  },

  // Production build configuration
  build: {
    // Output directory for production builds
    outDir: 'dist',
    // Generate source maps for production debugging
    sourcemap: true,
    // Use Terser for optimal minification
    minify: 'terser',
    // Target modern browsers for better optimization
    target: 'esnext',
    // Configure chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Rollup-specific options
    rollupOptions: {
      output: {
        // Optimize chunk distribution
        manualChunks: {
          vendor: [
            'react',
            'react-dom',
            'react-router-dom'
          ],
          // Separate material-ui chunks
          mui: [
            '@mui/material',
            '@mui/icons-material'
          ]
        },
        // Asset file naming pattern
        assetFileNames: 'assets/[name].[hash].[ext]',
        // Chunk file naming pattern
        chunkFileNames: 'js/[name].[hash].js',
        // Entry file naming pattern
        entryFileNames: 'js/[name].[hash].js'
      }
    },
    // Terser optimization options
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production'
      }
    }
  },

  // Preview server configuration for production testing
  preview: {
    // Use same port as development for consistency
    port: 3000,
    // Ensure strict port usage
    strictPort: true,
    // Enable network access for team testing
    host: true
  },

  // Environment variable configuration
  envPrefix: 'VITE_',
  
  // Performance optimizations
  optimizeDeps: {
    // Include dependencies that need optimization
    include: ['react', 'react-dom', 'react-router-dom'],
    // Enable dependency optimization caching
    force: false
  },

  // CSS configuration
  css: {
    // Enable CSS modules
    modules: {
      // Configure CSS module class naming
      generateScopedName: process.env.NODE_ENV === 'production'
        ? '[hash:base64:8]'
        : '[name]__[local]__[hash:base64:5]'
    },
    // PostCSS configuration
    postcss: {
      // Enable autoprefixer for browser compatibility
      plugins: [
        require('autoprefixer')
      ]
    }
  },

  // Enable experimental features for modern development
  experimental: {
    // Enable build-time optimizations
    renderBuiltUrl: (filename: string) => ({
      relative: true
    })
  }
});