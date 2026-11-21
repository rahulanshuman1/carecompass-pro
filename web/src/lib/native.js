/** Helpers for running inside the Capacitor Android app. */
export const isNative = () => {
  try { return !!window.Capacitor?.isNativePlatform?.(); } catch { return false; }
};

const KEY = 'cc_native_rt';
export const getRefreshToken = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setRefreshToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };

/** Where the "Download Android app" button points. Override with VITE_ANDROID_APK_URL. */
export const ANDROID_APK_URL = import.meta.env.VITE_ANDROID_APK_URL
  || 'https://github.com/rahulanshuman1/carecompass-pro/releases/download/android-latest/CareCompass.apk';
