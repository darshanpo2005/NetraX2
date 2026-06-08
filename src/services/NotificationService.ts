import * as Notifications from 'expo-notifications';

const notificationsAvailable = () => {
  try {
    require('expo-notifications');
    return true;
  } catch {
    return false;
  }
};

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // notifications not available in dev build
}

export const requestNotificationPermission = async (): Promise<void> => {
  if (!notificationsAvailable()) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  } catch {
    // notifications not available in dev build
  }
};

export const notifyAttendanceMarked = async (workerName: string, time: string): Promise<void> => {
  if (!notificationsAvailable()) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Attendance Marked ✅',
        body: `${workerName} checked in at ${time}`,
      },
      trigger: null,
    });
  } catch {
    // notifications not available in dev build
  }
};

export const notifyWorkerRegistered = async (workerName: string): Promise<void> => {
  if (!notificationsAvailable()) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Worker Registered ✅',
        body: `${workerName} has been enrolled successfully`,
      },
      trigger: null,
    });
  } catch {
    // notifications not available in dev build
  }
};
