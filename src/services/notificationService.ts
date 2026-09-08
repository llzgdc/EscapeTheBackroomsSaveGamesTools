import { createApp, h, ref } from "vue";
import NotificationPopup from "@/components/ui/NotificationPopup.vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import type { NotificationOptions } from "@/types/ui";

interface NotificationPopupInstance {
  add(options: NotificationOptions): string;
  close(id: string): void;
  closeAll(): void;
}

let notificationInstance: NotificationPopupInstance | null = null;
// In-flight init promise: two notify.* calls in the same tick both see a null
// instance, and without this guard each would create its own mount point +
// app instance (the first one leaks, never unmounted).
let notificationInitPromise: Promise<NotificationPopupInstance> | null = null;
let mountPoint: HTMLDivElement | null = null;
const ENABLE_NOTIFICATION = true;

const createNotificationApp = (): Promise<NotificationPopupInstance> => {
  mountPoint = document.createElement("div");
  mountPoint.id = "notification-container";
  document.body.appendChild(mountPoint);
  const notificationRef = ref<NotificationPopupInstance | null>(null);
  const app = createApp({
    setup() {
      return () => h(NotificationPopup, { ref: notificationRef });
    },
  });
  app.component("FontAwesomeIcon", FontAwesomeIcon);
  app.mount(mountPoint);
  return new Promise((resolve) => {
    const checkRef = () => {
      if (notificationRef.value) {
        notificationInstance = notificationRef.value;
        resolve(notificationInstance);
      } else requestAnimationFrame(checkRef);
    };
    checkRef();
  });
};

const initNotification = (): Promise<NotificationPopupInstance> => {
  if (notificationInstance) return Promise.resolve(notificationInstance);
  if (!notificationInitPromise) {
    notificationInitPromise = createNotificationApp();
  }
  return notificationInitPromise;
};

const getInstance = async (): Promise<NotificationPopupInstance | null> => {
  if (!ENABLE_NOTIFICATION) return null;
  if (!notificationInstance) await initNotification();
  return notificationInstance;
};

const show = async (options: NotificationOptions): Promise<string | null> => {
  const instance = await getInstance();
  if (!instance) return null;
  return instance.add(options);
};

const success = async (message: string, options: Partial<NotificationOptions> = {}): Promise<string | null> =>
  show({ message, type: "success", ...options });
const error = async (message: string, options: Partial<NotificationOptions> = {}): Promise<string | null> =>
  show({ message, type: "error", ...options });
const warning = async (message: string, options: Partial<NotificationOptions> = {}): Promise<string | null> =>
  show({ message, type: "warning", ...options });
const info = async (message: string, options: Partial<NotificationOptions> = {}): Promise<string | null> =>
  show({ message, type: "info", ...options });
const close = async (id: string): Promise<void> => {
  const instance = await getInstance();
  if (instance) instance.close(id);
};
const closeAll = async (): Promise<void> => {
  const instance = await getInstance();
  if (instance) instance.closeAll();
};

export const notify = { show, success, error, warning, info, close, closeAll };
export default notify;
export { show as showPopup, success as showSuccess, error as showError, warning as showWarning, info as showInfo };
