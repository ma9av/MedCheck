import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { Medication } from "./storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;
  
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID || 'your-project-id';
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('Push token:', token);
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export async function scheduleMedicationReminder(
  medication: Medication
): Promise<string[]> {
  if (!medication.reminderEnabled) return [];

  try {
    await cancelMedicationReminders(medication.id);
    
    const identifiers: string[] = [];
    
    for (const time of medication.times) {
      const [hours, minutes] = time.split(":").map(Number);
      
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      console.log(`Scheduling reminder for ${medication.name} at ${time} (${scheduledTime.toLocaleString()})`);
      
      const trigger: Notifications.NotificationTriggerInput = {
        channelId: 'default',
        date: scheduledTime,
        repeats: true,
      };
      
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Medication Reminder",
          body: `Time to take ${medication.name} (${medication.dosage})`,
          data: { 
            medicationId: medication.id,
            scheduledTime: time,
            type: "medication"
          },
          sound: true,
        },
        trigger,
      });
      
      identifiers.push(identifier);
      console.log(`Scheduled notification with ID: ${identifier}`);
    }
    
    return identifiers;
  } catch (error) {
    console.error("Error scheduling medication reminder:", error);
    return [];
  }
}

export async function scheduleRefillReminder(
  medication: Medication
): Promise<string | undefined> {
  if (!medication.refillReminder) return;

  try {
    await cancelRefillReminders(medication.id);
    
    const daysUntilRefill = calculateDaysUntilRefill(medication);
    
    if (daysUntilRefill <= 0) {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Refill Reminder",
          body: `Time to refill ${medication.name}. Your supply is running low.`,
          data: { 
            medicationId: medication.id,
            type: "refill"
          },
          sound: true,
        },
        trigger: null,
      });
      console.log(`Scheduled immediate refill reminder with ID: ${identifier}`);
      return identifier;
    } else {
      const refillDate = new Date();
      refillDate.setDate(refillDate.getDate() + daysUntilRefill);
      refillDate.setHours(9, 0, 0, 0);
      
      console.log(`Scheduling refill reminder for ${medication.name} on ${refillDate.toLocaleDateString()}`);
      
      const trigger: Notifications.NotificationTriggerInput = {
        channelId: 'default',
        date: refillDate,
        repeats: false,
      };
      
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Refill Reminder",
          body: `Time to refill ${medication.name}. Your supply is running low.`,
          data: { 
            medicationId: medication.id,
            type: "refill"
          },
          sound: true,
        },
        trigger,
      });
      
      console.log(`Scheduled refill reminder with ID: ${identifier}`);
      return identifier;
    }
  } catch (error) {
    console.error("Error scheduling refill reminder:", error);
    return undefined;
  }
}

function calculateDaysUntilRefill(medication: Medication): number {
  const { currentSupply, refillAt, frequency } = medication;
  
  if (currentSupply === undefined || currentSupply === null) return 0;
  
  if (currentSupply <= refillAt) return 0;
  
  let dailyUsage = 0;
  
  if (frequency === "Once daily") dailyUsage = 1;
  else if (frequency === "Twice daily") dailyUsage = 2;
  else if (frequency === "Three times daily") dailyUsage = 3;
  else if (frequency === "Four times daily") dailyUsage = 4;
  else if (frequency === "As needed") dailyUsage = 0.5;
  
  if (dailyUsage === 0) return 7;
  
  const supplyUntilRefill = currentSupply - refillAt;
  const daysUntilRefill = Math.floor(supplyUntilRefill / dailyUsage);
  
  return Math.max(0, daysUntilRefill);
}

export async function cancelMedicationReminders(medicationId: string): Promise<void> {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`Found ${scheduledNotifications.length} scheduled notifications`);
    
    let cancelCount = 0;
    for (const notification of scheduledNotifications) {
      const data = notification.content.data as any;
      
      if (data && data.medicationId === medicationId && data.type === "medication") {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        cancelCount++;
      }
    }
    
    console.log(`Canceled ${cancelCount} medication reminders for medication ${medicationId}`);
  } catch (error) {
    console.error("Error canceling medication reminders:", error);
  }
}

export async function cancelRefillReminders(medicationId: string): Promise<void> {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    let cancelCount = 0;
    for (const notification of scheduledNotifications) {
      const data = notification.content.data as any;
      
      if (data && data.medicationId === medicationId && data.type === "refill") {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        cancelCount++;
      }
    }
    
    console.log(`Canceled ${cancelCount} refill reminders for medication ${medicationId}`);
  } catch (error) {
    console.error("Error canceling refill reminders:", error);
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("Canceled all scheduled notifications");
  } catch (error) {
    console.error("Error canceling all notifications:", error);
  }
}

export async function listAllScheduledNotifications(): Promise<void> {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`===== ${scheduledNotifications.length} SCHEDULED NOTIFICATIONS =====`);
    
    scheduledNotifications.forEach((notification, index) => {
      const trigger = notification.trigger as any;
      const triggerDate = trigger.date ? new Date(trigger.date) : 'No date';
      
      console.log(`[${index + 1}] ID: ${notification.identifier}`);
      console.log(`    Title: ${notification.content.title}`);
      console.log(`    Body: ${notification.content.body}`);
      console.log(`    Data: ${JSON.stringify(notification.content.data)}`);
      console.log(`    Trigger: ${triggerDate}`);
      console.log(`    Repeats: ${trigger.repeats ? 'Yes' : 'No'}`);
      console.log('-----------------------------------');
    });
  } catch (error) {
    console.error("Error listing scheduled notifications:", error);
  }
}
