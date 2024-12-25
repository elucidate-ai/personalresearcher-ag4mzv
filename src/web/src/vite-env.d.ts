/// <reference types="vite/client" /> // Version: ^4.4.0

// Environment variable interface declaration
interface ImportMetaEnv {
  /**
   * Base URL for API endpoints
   * @type {string}
   */
  readonly VITE_API_URL: string;

  /**
   * Auth0 domain for authentication
   * @type {string}
   */
  readonly VITE_AUTH0_DOMAIN: string;

  /**
   * Auth0 client identifier
   * @type {string}
   */
  readonly VITE_AUTH0_CLIENT_ID: string;

  /**
   * Auth0 API audience identifier
   * @type {string}
   */
  readonly VITE_AUTH0_AUDIENCE: string;
}

// Extend ImportMeta interface
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Static asset type declarations
declare module '*.svg' {
  /**
   * SVG image import type
   * @type {string}
   */
  const url: string;
  export default url;
}

declare module '*.png' {
  /**
   * PNG image import type
   * @type {string}
   */
  const url: string;
  export default url;
}

declare module '*.jpg' {
  /**
   * JPG image import type
   * @type {string}
   */
  const url: string;
  export default url;
}

declare module '*.jpeg' {
  /**
   * JPEG image import type
   * @type {string}
   */
  const url: string;
  export default url;
}

declare module '*.gif' {
  /**
   * GIF image import type
   * @type {string}
   */
  const url: string;
  export default url;
}

declare module '*.woff' {
  /**
   * WOFF font import type
   * @type {string}
   */
  const url: string;
  export default url;
}

declare module '*.woff2' {
  /**
   * WOFF2 font import type
   * @type {string}
   */
  const url: string;
  export default url;
}

declare module '*.ttf' {
  /**
   * TTF font import type
   * @type {string}
   */
  const url: string;
  export default url;
}

declare module '*.eot' {
  /**
   * EOT font import type
   * @type {string}
   */
  const url: string;
  export default url;
}

declare module '*.css' {
  /**
   * CSS file import type
   * @type {string}
   */
  const content: string;
  export default content;
}

declare module '*.json' {
  /**
   * JSON file import type
   * @type {any}
   */
  const content: any;
  export default content;
}