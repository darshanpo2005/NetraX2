import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const requestNotificationPermission = async (): Promise<void> => {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
};

export const notifyAttendanceMarked = async (workerName: string, time: string): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Attendance Marked ✅',
        body: `${workerName} checked in at ${time}`,
      },
      trigger: null,
    });
  } catch {
    // Notifications are non-critical — swallow errors silently
  }
};

export const notifyWorkerRegistered = async (workerName: string): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Worker Registered ✅',
        body: `${workerName} has been enrolled successfully`,
      },
      trigger: null,
    });
  } catch {
    // Notifications are non-critical — swallow errors silently
  }
};
