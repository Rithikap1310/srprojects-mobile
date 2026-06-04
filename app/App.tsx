import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Platform,
  StatusBar,
  ToastAndroid,
  PermissionsAndroid,
  LogBox,
} from 'react-native';
import WebView, { WebViewNavigation } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { request, PERMISSIONS } from 'react-native-permissions';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import SplashScreen from 'react-native-splash-screen';

import { APP_URL, STATUS_BAR_COLOR } from './utils';

const ANDROID_SDK_30 = 30;

const INJECTED_JAVASCRIPT = `(function() {
  const meta = document.createElement('meta'); 
  meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'); 
  meta.setAttribute('name', 'viewport'); 
  document.getElementsByTagName('head')[0].appendChild(meta);
})();`;


const App: React.FC = () => {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView | null>(null);

  const [statusBarColor, setStatusBarColor] = useState<string>('');
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [backClickCount, setBackClickCount] = useState<number>(0);
  // Hide splash screen on mount
  useEffect(() => {
    SplashScreen.hide();
  }, []);

  const requestBasicPermissions = async () => {
    try {
      if (Platform.OS === 'ios') {
        await request(PERMISSIONS.IOS.CAMERA);
        await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      } else {
        await request(PERMISSIONS.ANDROID.CAMERA);
      }
    } catch (err) {
      console.warn('Permission request error', err);
    }
  };

  const requestAndroidWritePermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      if (Platform.Version < ANDROID_SDK_30) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage permission required',
            message:
              'This app needs access to your storage to save files to Downloads',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        return false;
      }
    } catch (err) {
      console.warn('Write permission request failed', err);
      return false;
    }
  };

  useEffect(() => {
    requestBasicPermissions();

    const backAction = (): boolean => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }

      if (backClickCount === 0) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        } else {
          Alert.alert('', 'Press back again to exit.');
        }
        setBackClickCount(1);
        setTimeout(() => setBackClickCount(0), 2000);
        return true;
      }

      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    return () => subscription.remove();
  }, [canGoBack, backClickCount]);

  useEffect(() => {
    const getLocalStorage = async () => {
      try {
        const color = await AsyncStorage.getItem('statusBarColor');
        if (color) {
          setStatusBarColor(color);
          if (Platform.OS === 'android') {
            StatusBar.setBackgroundColor(color, true);
          }
        }
      } catch (err) {
        console.warn('Failed to load statusBarColor', err);
      }
    };
    getLocalStorage();
  }, []);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  };

  const downloadToLocal = async (
    remoteUrl: string,
    suggestedFileName?: string,
  ) => {
    try {
      const urlParts = remoteUrl.split('?')[0].split('/');
      let filename =
        suggestedFileName ||
        urlParts[urlParts.length - 1] ||
        `file_${Date.now()}`;

      if (!filename.includes('.') && filename.indexOf('?') !== -1) {
        filename = `file_${Date.now()}`;
      }

      const localPath = `${RNFS.DocumentDirectoryPath}/${filename}`;
      console.log('[download] saving to localPath:', localPath);

      const exists = await RNFS.exists(localPath);
      if (exists) {
        await RNFS.unlink(localPath).catch(() => { });
      }

      const dl = RNFS.downloadFile({
        fromUrl: remoteUrl,
        toFile: localPath,
        background: false,
        discretionary: false,
      });

      const result = await dl.promise;
      console.log('[download] result', result);

      if (
        result.statusCode &&
        result.statusCode >= 200 &&
        result.statusCode < 300
      ) {
        if (Platform.OS === 'android' && Platform.Version < ANDROID_SDK_30) {
          const canWrite = await requestAndroidWritePermission();
          if (canWrite) {
            try {
              const destPath = `${RNFS.DownloadDirectoryPath}/${filename}`;
              await RNFS.copyFile(localPath, destPath);
              console.log('[download] copied to public downloads at', destPath);
              return destPath;
            } catch (copyErr) {
              console.warn('[download] copy to pub downloads failed', copyErr);
              return localPath;
            }
          } else {
            return localPath;
          }
        }

        return localPath;
      }

      throw new Error(`Download failed with status ${result.statusCode}`);
    } catch (err: any) {
      console.error('[downloadToLocal] error', err);
      throw err;
    }
  };

  const downloadFile = async (url: string) => {
    try {
      const finalPath = await downloadToLocal(url);
      Alert.alert('Download Success', `Saved to: ${finalPath}`);
      console.log('File saved at:', finalPath);
    } catch (err) {
      Alert.alert('Download Error', 'Failed to download file.');
      console.error('Failed to download file:', err);
    }
  };

  const shareFile = async (
    remoteUrl: string,
    mimeType?: string,
    suggestedFilename?: string,
  ) => {
    try {
      const localPath = await downloadToLocal(remoteUrl, suggestedFilename);
      const uri = `file://${localPath}`;

      console.log('[shareFile] sharing', uri, 'mimeType', mimeType);

      await Share.open({
        url: uri,
        type: mimeType,
      });

      Alert.alert('Success', 'File shared successfully.');
    } catch (err: any) {
      console.error('[shareFile] error', err);
      Alert.alert(
        'Error',
        `Failed to download or share file. ${err?.message || ''}`,
      );
    }
  };

  const shareExcelFile = async (excelUrl: string) => {
    await shareFile(
      excelUrl,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      undefined,
    );
  };

  const sharePdfFile = async (pdfUrl: string) => {
    await shareFile(pdfUrl, 'application/pdf', undefined);
  };

  const shareImageFromUrl = async (imageUrl: string) => {
    try {
      const ext = (imageUrl.split('.').pop() || 'jpg')
        .split('?')[0]
        .toLowerCase();
      const fileName = `image_${Date.now()}.${ext}`;
      await shareFile(
        imageUrl,
        `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        fileName,
      );
    } catch (err) {
      console.error('Error sharing image', err);
      Alert.alert('Error', 'Failed to download or share the image.');
    }
  };

  const postMessage = async (event: any) => {
    try {
      if (!event?.nativeEvent?.data) return;

      let payload: any = null;
      try {
        payload = JSON.parse(event.nativeEvent.data);
      } catch (err) {
        console.warn(
          'postMessage: payload not JSON, ignoring',
          event.nativeEvent.data,
        );
        return;
      }

      const data = payload?.data ?? payload;

      if (!data) return;

      // ==================== ASYNC STORAGE OPERATIONS ====================

      // Get data from AsyncStorage
      if (data.action === 'getFromAsyncStorage' && data.key) {
        console.log('[AsyncStorage] Getting key:', data.key);
        const value = await AsyncStorage.getItem(data.key);
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'asyncStorageData',
            key: data.key,
            value: value,
            success: true,
          }),
        );
      }

      // Save data to AsyncStorage
      if (data.action === 'saveToAsyncStorage' && data.key && data.value) {
        console.log('[AsyncStorage] Saving key:', data.key);
        await AsyncStorage.setItem(data.key, data.value);
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'asyncStorageSaved',
            key: data.key,
            success: true,
          }),
        );
      }

      // Remove data from AsyncStorage
      if (data.action === 'removeFromAsyncStorage' && data.key) {
        console.log('[AsyncStorage] Removing key:', data.key);
        await AsyncStorage.removeItem(data.key);
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'asyncStorageRemoved',
            key: data.key,
            success: true,
          }),
        );
      }

      // ==================== STATUS BAR COLOR ====================

      if (data.statusBarColor) {
        const color = data.statusBarColor;
        await AsyncStorage.setItem('statusBarColor', color);
        setStatusBarColor(color);
        if (Platform.OS === 'android') {
          StatusBar.setBackgroundColor(color, true);
        }
      }

      // ==================== LOGOUT ====================

      if (data.status === 'logout') {
        await AsyncStorage.clear();
        setStatusBarColor('');
      }

      // ==================== NOTIFICATION PERMISSION ====================

      // Request notification permission and get FCM token (called after login)
      if (
        data.action === 'requestNotificationPermission' &&
        data.userId &&
        data.companyId
      ) {
        console.log(
          '[App] Requesting notification permission (disabled/mocked) for user:',
          data.userId,
        );
        // Send failure token back to WebView immediately since FCM is disabled/removed
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'fcmTokenResult',
            success: false,
            token: null,
          }),
        );
      }

      // Get existing FCM token (if already granted)
      if (data.action === 'getFCMToken') {
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'fcmToken',
            token: null,
          }),
        );
      }

      // ==================== SHARING & DOWNLOADS ====================

      // Video share
      if (data.videourl) {
        await Share.open({ url: data.videourl });
      }

      // Image share
      if (data.url) {
        await shareImageFromUrl(data.url);
      }

      // Download
      if (data.downloadurl) {
        await downloadFile(data.downloadurl);
      }

      // Excel
      if (data.excelurl) {
        await shareExcelFile(data.excelurl);
      }

      // PDF
      if (data.pdfurl) {
        await sharePdfFile(data.pdfurl);
      }
    } catch (err) {
      console.error('[postMessage] Failed to handle event:', err);
    }
  };

  return (
    <SafeAreaView
      edges={['right', 'left', 'bottom']}
      style={{
        flex: 1,
        backgroundColor: statusBarColor || STATUS_BAR_COLOR,
        paddingTop: insets.top,
      }}>
      <StatusBar
        backgroundColor={statusBarColor || STATUS_BAR_COLOR}
        barStyle="light-content"
      />
      <WebView
        ref={webViewRef}
        source={{ uri: APP_URL }}
        // userAgent="VRLD-Mobile-App"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        automaticallyAdjustContentInsets={false}
        onNavigationStateChange={handleNavigationStateChange}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onMessage={postMessage}
        androidLayerType="hardware"
        scalesPageToFit={false}
        injectedJavaScript={INJECTED_JAVASCRIPT}
        setBuiltInZoomControls={false}
        mediaPlaybackRequiresUserAction={false}
      />
    </SafeAreaView>
  );
};

export default App;
