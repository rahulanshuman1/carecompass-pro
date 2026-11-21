/**
 * Where the "Download app" buttons point. For now both go to the project's GitHub Actions page,
 * where the latest workflow run holds the Android APK and iOS build as downloadable artifacts.
 * Override on Vercel with VITE_ANDROID_APK_URL / VITE_IOS_APP_URL (for example a direct artifact,
 * a release asset, or later the Play Store and App Store links).
 */
const ACTIONS = 'https://github.com/rahulanshuman1/carecompass-pro/actions';
export const APP_LINKS = {
  android: import.meta.env.VITE_ANDROID_APK_URL || ACTIONS,
  ios: import.meta.env.VITE_IOS_APP_URL || ACTIONS,
};
