import { useRef, useEffect, useState } from 'react';
import {
  BackHandler,
  ToastAndroid,
  StatusBar,
  View,
  Platform,
  Alert,
} from 'react-native';
import WebView, { WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { APP_URL, STATUS_BAR_COLOR } from './utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { request, PERMISSIONS } from 'react-native-permissions';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
// import RNFetchBlob from 'rn-fetch-blob';

const App = () => {
  const insets = useSafeAreaInsets();

  const [statusBarColor, setStatusBarColor] = useState('');

  // Ref to WebView component
  const webViewRef = useRef<WebView | null>(null);

  // State to track whether WebView can go back
  const [canGoBack, setCanGoBack] = useState<boolean>(false);

  // State to track back button click count for exit confirmation
  const [backClickCount, setBackClickCount] = useState<number>(0)


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
        setStatusBarColor('');
      }
      if (data?.data?.videourl) {
        await Share.open({ url: data.data.videourl }); // Share the URL
      }
      // if (data?.data?.url) {
      //   const imageUrl = data.data.url;

      //   // Fetch the image and convert it to base64
      //   const base64Image = await RNFetchBlob.config({
      //     fileCache: false,
      //   })
      //     .fetch('GET', imageUrl)
      //     .then(resp => resp.base64());

      //   // Share the image using the base64 string
      //   await Share.open({
      //     url: `data:image/jpeg;base64,${base64Image}`, // Adjust MIME type as needed
      //   });
      // }
      if (data?.data?.url) {
        const imageUrl = data.data.url;

        try {
          // Fetch the image
          const response = await fetch(imageUrl);
          const blob = await response.blob();

          // Get the file extension from the URL (e.g., .jpeg, .png)
          const fileExtension = imageUrl.split('.').pop();

          // Convert the Blob into base64 using FileReader
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Image = reader.result?.split(',')[1];

            // If image conversion to base64 is successful, share it
            if (base64Image) {
              await Share.open({
                url: `data:image/${fileExtension};base64,${base64Image}`,
              });
              Alert.alert('Success', 'Image shared successfully.');
            } else {
              throw new Error('Base64 conversion failed');
            }
          };
          reader.readAsDataURL(blob);
        } catch (error) {
          console.error('Error sharing image:', error);
          Alert.alert('Error', 'Failed to download or share the image.');
        }
      }


      if (data?.data?.downloadurl) {
        downloadFile(data.data.downloadurl);
      }

      if (data?.data?.excelurl) {
        const excelUrl = data.data.excelurl;
        shareExcelFile(excelUrl);
      }
      if (data?.data?.pdfurl) {
        const pdfUrl = data.data.pdfurl;
        sharePdfFile(pdfUrl);
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


  const downloadFile = async (url: string) => {
    try {
      const fileName = url.split('/').pop(); // Get the file name
      const fileExtension = fileName?.split('.').pop(); // Extract file extension
      const downloadDest = Platform.OS === 'android'
        ? `${RNFS.DownloadDirectoryPath}/${fileName}`
        : `${RNFS.DocumentDirectoryPath}/${fileName}`;

      // Download the file using react-native-fs
      const downloadResult = await RNFS.downloadFile({
        fromUrl: url,
        toFile: downloadDest,
        background: true, // Continue in background for Android
        discretionary: true, // Discretionary download for iOS
      }).promise;

      if (downloadResult && downloadResult.statusCode === 200) {
        Alert.alert('Download Success', `File downloaded to ${downloadDest}`);
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      Alert.alert('Download Error', 'Failed to download file.');
      console.error('Failed to download file:', error);
    }
  };


  // Function to download and share the Excel file
  const shareExcelFile = async (excelUrl: string) => {
    try {
      let fileName = excelUrl.split('/').pop(); // Get the file name from the URL

      // Ensure a valid filename is retrieved, fallback if needed
      if (!fileName || fileName.includes('?')) {
        fileName = 'default_excel_file.xlsx'; // Fallback file name
      }

      const downloadDest = Platform.OS === 'android'
        ? `${RNFS.DownloadDirectoryPath}/${fileName}`
        : `${RNFS.DocumentDirectoryPath}/${fileName}`;

      // Download the Excel file to the device
      const downloadResult = await RNFS.downloadFile({
        fromUrl: excelUrl,
        toFile: downloadDest,
        background: true, // Continue download in the background
        discretionary: true, // Use discretionary download on iOS
      }).promise;

      if (downloadResult && downloadResult.statusCode === 200) {
        // console.log('Excel file downloaded successfully', downloadDest);

        // Share the downloaded Excel file
        await Share.open({
          url: `file://${downloadDest}`, // Sharing the file with its local file path
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // MIME type for Excel files
          title: 'Share Excel File',
          subject: 'Check out this Excel file!',
        });

        Alert.alert('Success', 'Excel file shared successfully.');
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Error sharing Excel file:', error);
      Alert.alert('Error', 'Failed to download or share the Excel file.');
    }
  };


  // Function to download and share the PDF file
  const sharePdfFile = async (pdfUrl: string) => {
    try {
      const fileName = pdfUrl.split('/').pop(); // Get the file name from the URL
      const downloadDest = Platform.OS === 'android'
        ? `${RNFS.DownloadDirectoryPath}/${fileName}` // Download directory for Android
        : `${RNFS.DocumentDirectoryPath}/${fileName}`; // Document directory for iOS

      // Download the PDF file to the device
      const downloadResult = await RNFS.downloadFile({
        fromUrl: pdfUrl,
        toFile: downloadDest,
        background: true, // Continue download in the background
        discretionary: true, // Use discretionary download on iOS
      }).promise;

      if (downloadResult && downloadResult.statusCode === 200) {
        // console.log('PDF file downloaded successfully', downloadDest);

        // Share the downloaded PDF file
        await Share.open({
          url: `file://${downloadDest}`, // Sharing the file with its local file path
          type: 'application/pdf', // MIME type for PDF files
          title: 'Share PDF File',
          subject: 'Check out this PDF!',
        });

        Alert.alert('Success', 'PDF file shared successfully.');
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Error sharing PDF file:', error);
      Alert.alert('Error', 'Failed to download or share the PDF file.');
    }
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
        source={{ uri: APP_URL }}
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
