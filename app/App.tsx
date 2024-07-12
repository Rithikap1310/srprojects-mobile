import {useRef, useEffect, useState} from 'react';
import {
  BackHandler,
  ToastAndroid,
  StatusBar,
  View,
  Platform,
} from 'react-native';
import WebView, {WebViewNavigation} from 'react-native-webview';
import {useSafeAreaInsets, SafeAreaView} from 'react-native-safe-area-context';
import {APP_URL, STATUS_BAR_COLOR} from './utils';
import AsyncStorage from '@react-native-async-storage/async-storage';

const App = () => {
  const insets = useSafeAreaInsets();

  const [statusBarColor, setStatusBarColor] = useState('');

  // Ref to WebView component
  const webViewRef = useRef<WebView | null>(null);

  // State to track whether WebView can go back
  const [canGoBack, setCanGoBack] = useState<boolean>(false);

  // State to track back button click count for exit confirmation
  const [backClickCount, setBackClickCount] = useState<number>(0);

  useEffect(() => {
    // Function to handle back button press
    const backAction = (): boolean => {
      if (canGoBack) {
        // If WebView can go back, navigate back
        webViewRef.current?.goBack();
        return true;
      } else {
        if (backClickCount === 0) {
          // If backClickCount is 0, show toast and set count to 1
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
          setBackClickCount(1);
          // Reset count after 2 seconds
          setTimeout(() => setBackClickCount(0), 2000);
          return true;
        } else {
          // If backClickCount is not 0, exit the app
          return false;
        }
      }
    };

    // Add event listener for hardware back press
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    // Remove event listener when component unmounts
    return () => backHandler.remove();
  }, [canGoBack, backClickCount]);

  // Function to handle WebView navigation state change
  const handleNavigationStateChange = (navState: WebViewNavigation): void => {
    // Update canGoBack state based on navigation state
    setCanGoBack(navState.canGoBack);
  };

  // Function to get local storage value for statusBarColor
  const getLocalStorage = async () => {
    const statusBarColor = await AsyncStorage.getItem('statusBarColor');
    if (statusBarColor) {
      setStatusBarColor(statusBarColor);
      // StatusBar.setBackgroundColor is not available on iOS, so adding it only for android
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(statusBarColor, true);
      }
    }
  };

  useEffect(() => {
    getLocalStorage();
  }, []);

  // Function to handle messages from WebView
  const postMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('postMessage data', data?.data);

      // // Handle statusBarColor
      if (data?.data?.statusBarColor) {
        // storing the token in AsyncStorage
        await AsyncStorage.setItem(
          'statusBarColor',
          data?.data?.statusBarColor,
        );
        setStatusBarColor(data?.data?.statusBarColor);
        // StatusBar.setBackgroundColor is not available on iOS, so adding it only for android
        if (Platform.OS === 'android') {
          StatusBar.setBackgroundColor(data?.data?.statusBarColor, true);
        }
      }

      // // Handle fcmToken
      // if (data.fcmToken) {
      //   await AsyncStorage.setItem('fcmToken', data.fcmToken);
      //   console.log('FCM token stored in AsyncStorage');
      // }
    } catch (error) {
      console.error('Failed to handle postMessage event', error);
    }
  };

  return (
    <SafeAreaView
      edges={['right', 'top', 'left']}
      style={{
        flex: 1,
        backgroundColor: statusBarColor || STATUS_BAR_COLOR,
      }}>
      {/* Status bar */}
      <StatusBar backgroundColor={statusBarColor || STATUS_BAR_COLOR} />

      {/* WebView component */}
      <WebView
        ref={webViewRef}
        source={{uri: APP_URL}}
        javaScriptEnabled={true} // Enable JavaScript
        domStorageEnabled={true} // Enable DOM storage
        startInLoadingState={true} // Start with loading indicator
        automaticallyAdjustContentInsets={false} // Do not adjust content insets automatically
        onNavigationStateChange={handleNavigationStateChange} // Handle navigation state change
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onMessage={postMessage}
      />
    </SafeAreaView>
  );
};

export default App;
