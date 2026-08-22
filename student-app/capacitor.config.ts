import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bijianyuntang.student',
  appName: '笔尖云堂学生端',
  webDir: 'dist',
  backgroundColor: '#f5f8fc',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#f5f8fc',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 900,
      backgroundColor: '#f5f8fcff',
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
