import { Capacitor } from '@capacitor/core';

/**
 * One-time native setup for the Capacitor shell. No-ops on the web build.
 * - Applies the status bar style and hides the splash screen once the app is ready.
 * Imported dynamically so web bundles never pull in native plugin code paths.
 */
export async function initNative(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
    } catch {
        // StatusBar is unavailable on some platforms (e.g. web) — ignore.
    }

    try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
    } catch {
        // ignore
    }
}
