import { dataService } from './dataService';

export const notificationService = {
  requestPermission: async (userId: string, showToast: (msg: string, type?: 'success' | 'error') => void) => {
    if (!('Notification' in window)) {
      showToast('هذا المتصفح لا يدعم التنبيهات', 'error');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        showToast('تم تفعيل التنبيهات بنجاح', 'success');
      } else {
        showToast('تم رفض التنبيهات. يرجى تفعيلها من إعدادات المتصفح', 'error');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      showToast('فشل تفعيل التنبيهات', 'error');
    }
  },

  onMessage: (callback: (payload: any) => void) => {
    // This would typically handle push messages from a service worker
    return () => {};
  }
};
