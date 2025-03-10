import React, { useEffect, useRef } from 'react';
import { Platform, Button, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Subscription } from 'expo-modules-core';
import { useDoseHistoryStore } from './utils/stores/doseHistoryStore';
import { listAllScheduledNotifications } from './utils/notifications';

// Your existing imports and setup...

export default function App() {
  const notificationListener = useRef<Subscription>();
  const responseListener = useRef<Subscription>();
  const { recordDose } = useDoseHistoryStore();

  useEffect(() => {
    // Set up notification listeners when the app starts
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      const data = response.notification.request.content.data as any;
      
      // Handle medication reminder response
      if (data && data.type === 'medication') {
        // Record the dose as taken when user taps on the notification
        recordDose(
          data.medicationId,
          true,
          new Date().toISOString(),
          data.scheduledTime
        ).catch(err => console.error('Error recording dose from notification:', err));
      }
    });

    // Request permissions
    Notifications.requestPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      } else {
        console.log('Notification permissions granted');
      }
    });

    // List all scheduled notifications on app start (for debugging)
    listAllScheduledNotifications();

    return () => {
      // Clean up listeners when component unmounts
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [recordDose]);

  // Your existing App component return...
  
  // If you want to add a debug button somewhere in your app:
  // <Button title="Debug Notifications" onPress={listAllScheduledNotifications} />
} 