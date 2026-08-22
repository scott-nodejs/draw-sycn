import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bijianyuntang.teacher',
  appName: '笔尖云堂老师端',
  webDir: 'dist',
  backgroundColor: '#f5f7fa',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#f5f7fa',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 900,
      backgroundColor: '#f5f7faff',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ffffffff',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
}

export default config
