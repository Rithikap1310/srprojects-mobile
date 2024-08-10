import {useRef, useEffect, useState} from 'react';
import {
  BackHandler,
  ToastAndroid,
  StatusBar,
  View,
  Platform,
  Alert,
} from 'react-native';
import WebView, {WebViewNavigation} from 'react-native-webview';
import {useSafeAreaInsets, SafeAreaView} from 'react-native-safe-area-context';
import {APP_URL, STATUS_BAR_COLOR} from './utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {request, PERMISSIONS} from 'react-native-permissions';
import Share from 'react-native-share';
import RNFetchBlob from 'rn-fetch-blob';

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
    // Request Permission from user
    const requestPermissions = async () => {
      if (Platform.OS === 'ios') {
        await request(PERMISSIONS.IOS.CAMERA);
        await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      } else if (Platform.OS === 'android') {
        await request(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
        await request(PERMISSIONS.ANDROID.CAMERA);
      }
    };

    requestPermissions();

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
      // console.log('postMessage data', data?.data);

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

      if (data?.data?.status === 'logout') {
        await AsyncStorage.clear();
        console.log('Logout successful');
        setStatusBarColor('');
      }
      // if (data?.data?.url) {
      //   await Share.open({ url: data.data.url }); // Share the URL
      // }
      if (data?.data?.url) {
        const imageUrl = data.data.url;

        // Fetch the image and convert it to base64
        const base64Image = await RNFetchBlob.config({
          fileCache: false,
        })
          .fetch('GET', imageUrl)
          .then(resp => resp.base64());

        // Share the image using the base64 string
        await Share.open({
          url: `data:image/jpeg;base64,${base64Image}`, // Adjust MIME type as needed
        });
      }

      if (data?.data?.downloadurl) {
        downloadFile(data.data.downloadurl);
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
  // Function to download a file from the given URL
  const downloadFile = (url: string) => {
    const {config, fs} = RNFetchBlob;
    let DownloadDir = fs.dirs.DownloadDir; // Downloads directory

    config({
      fileCache: true,
      addAndroidDownloads: {
        useDownloadManager: true,
        notification: true,
        path: DownloadDir + '/' + url.split('/').pop(), // Set the path where the file will be saved
        description: 'Downloading file.',
      },
    })
      .fetch('GET', url)
      .then(res => {
        Alert.alert('Download Success', 'File downloaded successfully.');
        console.log('The file saved to ', res.path());
      })
      .catch(error => {
        Alert.alert('Download Error', 'Failed to download file.');
        console.error('Failed to download file', error);
      });
  };
  const INJECTED_JAVASCRIPT = `(function() {
    const meta = document.createElement('meta'); meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'); meta.setAttribute('name', 'viewport'); document.getElementsByTagName('head')[0].appendChild(meta);
  })();`;

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
        androidLayerType="hardware" // to fix android lag lag issues
        scalesPageToFit={false}
        injectedJavaScript={INJECTED_JAVASCRIPT}
        setBuiltInZoomControls={false}
        mediaPlaybackRequiresUserAction={false}
      />
    </SafeAreaView>
  );
};

export default App;
