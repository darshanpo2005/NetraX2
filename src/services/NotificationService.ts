export const notifyAttendanceMarked = async (workerName: string, time: string): Promise<void> => {
  try {
    const Notifications = require('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Attendance Marked ✅',
        body: `${workerName} checked in at ${time}`,
      },
      trigger: null,
    });
  } catch {
    // not available in dev build
  }
};

export const notifyWorkerRegistered = async (workerName: string): Promise<void> => {
  try {
    const Notifications = require('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Worker Registered ✅',
        body: `${workerName} has been enrolled successfully`,
      },
      trigger: null,
    });
  } catch {
    // not available in dev build
  }
};
