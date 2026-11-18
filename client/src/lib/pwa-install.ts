export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallPromptSubscriber = (event: BeforeInstallPromptEvent | null) => void;

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let listenerAttached = false;
const subscribers = new Set<InstallPromptSubscriber>();

function notifySubscribers() {
  subscribers.forEach(subscriber => subscriber(deferredInstallPrompt));
}

function ensureListener() {
  if (typeof window === "undefined" || listenerAttached) return;
  const onBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    notifySubscribers();
  };
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  listenerAttached = true;
}

export function subscribeToBeforeInstallPrompt(subscriber: InstallPromptSubscriber) {
  ensureListener();
  subscribers.add(subscriber);
  if (deferredInstallPrompt) subscriber(deferredInstallPrompt);
  return () => subscribers.delete(subscriber);
}

export function clearBeforeInstallPrompt() {
  deferredInstallPrompt = null;
  notifySubscribers();
}
