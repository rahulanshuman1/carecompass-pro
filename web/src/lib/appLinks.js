/**
 * Where the "Download app" buttons point.
 * Android: the APK that .github/workflows/android.yml publishes to the rolling "android-latest" release.
 * iOS: the "ios-latest" release for now; once you have an Apple Developer account, set VITE_IOS_APP_URL
 * on Vercel to your TestFlight public link or App Store URL.
 * Override on Vercel with VITE_ANDROID_APK_URL / VITE_IOS_APP_URL.
 */
const REPO = 'https://github.com/rahulanshuman1/carecompass-pro';
export const APP_LINKS = {
  android: import.meta.env.VITE_ANDROID_APK_URL || `${REPO}/releases/download/android-latest/CareCompass.apk`,
  ios: import.meta.env.VITE_IOS_APP_URL || `${REPO}/releases/tag/ios-latest`,
};
