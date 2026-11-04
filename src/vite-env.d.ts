/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // Add other environment variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Ambient declarations for optional native Capacitor plugins to ensure
// headless web and CI builds compile safely even if native packages are omitted.
declare module '@capacitor/status-bar' {
  export enum Style {
    Dark = 'DARK',
    Light = 'LIGHT',
    Default = 'DEFAULT',
  }
  export interface StatusBarPlugin {
    setStyle(options: { style: Style }): Promise<void>;
    setBackgroundColor(options: { color: string }): Promise<void>;
  }
  export const StatusBar: StatusBarPlugin;
}
