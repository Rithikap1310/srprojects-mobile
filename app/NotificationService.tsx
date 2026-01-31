import {getApp} from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  requestPermission,
  AuthorizationStatus,
  onNotificationOpenedApp,
  getInitialNotification,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import {Platform, PermissionsAndroid, Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class NotificationService {
  private fcmToken: string | null = null;
  private isInitialized: boolean = false;

  // Initialize listeners only (no permission request)
  async initializeListeners() {
    if (this.isInitialized) return;

    console.log('[FCM] 🎧 Setting up notification listeners...');
    const messaging = getMessaging(getApp());

    // Foreground notifications
    onMessage(messaging, async remoteMessage => {
      console.log('[FCM] 📬 Foreground notification received:', remoteMessage);

      if (remoteMessage.notification) {
        Alert.alert(
          remoteMessage.notification.title || 'Notification',
          remoteMessage.notification.body || '',
        );
      }
    });

    // Background notification tap
    onNotificationOpenedApp(messaging, remoteMessage => {
      console.log(
        '[FCM] 👆 Notification opened app from background:',
        remoteMessage,
      );
      this.handleNotificationNavigation(remoteMessage);
    });

    // Quit state notification tap
    getInitialNotification(messaging).then(remoteMessage => {
      if (remoteMessage) {
        console.log(
          '[FCM] 🚀 Notification opened app from quit state:',
          remoteMessage,
        );
        this.handleNotificationNavigation(remoteMessage);
      }
    });

    // Token refresh
    onTokenRefresh(messaging, async token => {
      console.log('[FCM] 🔄 Token refreshed:', token);
      this.fcmToken = token;
      await AsyncStorage.setItem('fcmToken', token);
      // Auto-send refreshed token to backend
      await this.sendTokenToBackend();
    });

    this.isInitialized = true;
    console.log('[FCM] ✅ Listeners initialized');
  }

  // Request permission and get token (called after login)
  async requestPermissionAndGetToken(
    userId: string,
    companyId: string,
  ): Promise<string | null> {
    console.log(userId, companyId);
    try {
      console.log(
        '[FCM] ========== START requestPermissionAndGetToken ==========',
      );
      console.log('[FCM] 🚀 User ID:', userId);
      console.log('[FCM] 🚀 Company ID:', companyId);

      const hasPermission = await this.requestUserPermission();
      console.log('[FCM] 🔐 Permission result:', hasPermission);

      if (!hasPermission) {
        console.log('[FCM] ❌ Permission denied - stopping here');
        return null;
      }

      console.log('[FCM] ✅ Permission granted, fetching token...');
      const token = await this.getFCMToken();
      console.log('[FCM] 🎫 Token obtained:', token ? 'YES' : 'NO');

      if (token) {
        // Store token with userId and companyId
        console.log('[FCM] 💾 Storing userId and companyId in AsyncStorage...');
        await AsyncStorage.setItem('fcmUserId', userId);
        await AsyncStorage.setItem('fcmCompanyId', companyId);
        console.log('[FCM] 💾 Stored successfully');

        // Send to backend
        console.log('[FCM] 📤 Calling sendTokenToBackend...');
        const result = await this.sendTokenToBackend(userId, token, companyId);
        console.log('[FCM] 📤 sendTokenToBackend result:', result);
      }

      console.log(
        '[FCM] ========== END requestPermissionAndGetToken ==========',
      );
      return token;
    } catch (error) {
      console.error(
        '[FCM] ❌❌❌ Error in requestPermissionAndGetToken:',
        error,
      );
      return null;
    }
  }

  async requestUserPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        console.log('[FCM] 📱 Requesting iOS permission...');
        const messaging = getMessaging(getApp());
        const authStatus = await requestPermission(messaging);
        const enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;

        console.log('[FCM] iOS Authorization status:', authStatus);
        return enabled;
      } else {
        const versionNumber =
          typeof Platform.Version === 'string'
            ? parseInt(Platform.Version, 10)
            : Platform.Version;

        console.log('[FCM] 🤖 Android version:', versionNumber);

        if (versionNumber >= 33) {
          console.log('[FCM] 🤖 Requesting Android 13+ permission...');
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          console.log('[FCM] Android notification permission result:', granted);
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        console.log('[FCM] Android < 13, permission auto-granted');
        return true;
      }
    } catch (error) {
      console.error('[FCM] ❌ Permission request error:', error);
      return false;
    }
  }

  async getFCMToken(): Promise<string | null> {
    try {
      console.log('[FCM] 🔄 Fetching FCM token from Firebase...');

      const messaging = getMessaging(getApp());
      const token = await getToken(messaging);

      console.log('[FCM] ✅ Token retrieved:', token);

      this.fcmToken = token;
      await AsyncStorage.setItem('fcmToken', token);

      return token;
    } catch (error) {
      console.error('[FCM] ❌ Error getting token:', error);
      return null;
    }
  }

  async sendTokenToBackend(
    userId?: string,
    token?: string,
    companyId?: string,
  ): Promise<boolean> {
    try {
      console.log('[FCM] ========== START sendTokenToBackend ==========');
      console.log(
        '[FCM] 📥 Received params - userId:',
        userId,
        'token:',
        token ? 'YES' : 'NO',
        'companyId:',
        companyId,
      );

      const fcmToken =
        token || this.fcmToken || (await AsyncStorage.getItem('fcmToken'));
      const storedUserId = userId || (await AsyncStorage.getItem('fcmUserId'));
      const storedCompanyId =
        companyId || (await AsyncStorage.getItem('fcmCompanyId'));

      console.log(
        '[FCM] 📥 Final values - userId:',
        storedUserId,
        'token:',
        fcmToken ? 'YES' : 'NO',
        'companyId:',
        storedCompanyId,
      );

      if (!fcmToken) {
        console.warn('[FCM] ⚠️ No token available to send');
        return false;
      }

      if (!storedUserId) {
        console.warn('[FCM] ⚠️ No userId available');
        return false;
      }

      if (!storedCompanyId) {
        console.warn('[FCM] ⚠️ No companyId available');
        return false;
      }

      const payload = {
        userId: storedUserId,
        fcmToken: fcmToken,
        platform: Platform.OS,
        companyId: storedCompanyId,
        deviceInfo: {
          os: Platform.OS,
          version: Platform.Version,
        },
      };

      console.log('[FCM] 📤 Sending to backend...');
      console.log(
        '[FCM] 📤 URL: https://garuda-server.onrender.com/api/store/pushnotif',
      );
      console.log('[FCM] 📤 Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(
        'https://garuda-server.onrender.com/api/store/pushnotif',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      console.log('[FCM] 📥 Response status:', response.status);
      console.log('[FCM] 📥 Response ok:', response.ok);

      const data = await response.json();
      console.log('[FCM] 📥 Response data:', JSON.stringify(data, null, 2));

      if (response.ok && data.success) {
        console.log('[FCM] ✅✅✅ Token sent to backend successfully');
        return true;
      } else {
        console.error(
          '[FCM] ❌ Backend returned error:',
          data.message || 'Unknown error',
        );
        return false;
      }
    } catch (error) {
      console.error('[FCM] ❌❌❌ Error sending token to backend:', error);
      if (error instanceof Error) {
        console.error('[FCM] Error message:', error.message);
        console.error('[FCM] Error stack:', error.stack);
      }
      return false;
    }
  }

  handleNotificationNavigation(remoteMessage: any) {
    const data = remoteMessage.data;

    if (data?.url) {
      console.log('[FCM] 🔗 Navigate to:', data.url);
      return data.url;
    }

    return null;
  }

  async getToken(): Promise<string | null> {
    if (this.fcmToken) {
      return this.fcmToken;
    }
    return await AsyncStorage.getItem('fcmToken');
  }

  // Clear token on logout
  async clearToken(): Promise<void> {
    try {
      this.fcmToken = null;
      await AsyncStorage.removeItem('fcmToken');
      await AsyncStorage.removeItem('fcmUserId');
      await AsyncStorage.removeItem('fcmCompanyId');
      console.log('[FCM] 🗑️ Token cleared');
    } catch (error) {
      console.error('[FCM] ❌ Error clearing token:', error);
    }
  }
}

export default new NotificationService();
