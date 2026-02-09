import { create } from "zustand";

type UpdateInfo = {
  currentVersion: string | null;
  latestVersion: string | null;
  hasUpdate: boolean;
  notesPreview: string | null;
  releaseUrl: string | null;
  downloadUrl: string | null;
  error: string | null;
};

type UpdateState = UpdateInfo & {
  status: string | null;
  isChecking: boolean;
  /** Seconds remaining before a manual check can be triggered again. */
  cooldownSecondsRemaining: number;
  /** Whether the global update prompt should currently be shown. */
  shouldShowPrompt: boolean;
  /** Run a GitHub Releases check via the Electron main process. */
  checkForUpdates: (options?: { manual?: boolean }) => Promise<void>;
  /** Decrement cooldown timer (in seconds). */
  decrementCooldown: (amount: number) => void;
  /** Clear transient status text (e.g. when reopening Settings). */
  clearStatus: () => void;
  /** Manually set status text (e.g. when starting or failing an install). */
  setStatus: (status: string | null) => void;
  /** Mark the current update prompt as seen so it doesn't keep reappearing. */
  markPromptSeen: () => void;
};

const INITIAL_STATE: UpdateInfo & {
  status: string | null;
  isChecking: boolean;
  cooldownSecondsRemaining: number;
  shouldShowPrompt: boolean;
} = {
  currentVersion: null,
  latestVersion: null,
  hasUpdate: false,
  notesPreview: null,
  releaseUrl: null,
  downloadUrl: null,
  error: null,
  status: null,
  isChecking: false,
  cooldownSecondsRemaining: 0,
  shouldShowPrompt: false,
};

const UPDATE_CHECK_COOLDOWN_SECONDS = 30;

export const useUpdateStore = create<UpdateState>((set, get) => {
  // Populate currentVersion early so the top bar label can render without a manual check.
  if (typeof window !== "undefined" && window.electronAPI?.getAppVersion) {
    void window.electronAPI
      .getAppVersion()
      .then((version) => {
        if (!version) return;
        set((prev) => (prev.currentVersion ? prev : { ...prev, currentVersion: version }));
      })
      .catch(() => {
        // ignore failures; version label will remain blank until an update check runs
      });
  }

  return {
    ...INITIAL_STATE,
    async checkForUpdates(options?: { manual?: boolean }) {
      const manual = options?.manual === true;

      if (typeof window === "undefined") return;
      const api = window.electronAPI;
      if (!api?.checkForUpdates) return;

      const state = get();
      if (manual) {
        if (state.isChecking || state.cooldownSecondsRemaining > 0) {
          return;
        }
      } else if (state.isChecking) {
        return;
      }

      set((prev) => ({
        ...prev,
        isChecking: true,
        error: null,
        status: manual ? "Checking for updates…" : prev.status,
      }));

      try {
        const info = await api.checkForUpdates();
        if (!info) {
          set((prev) => ({
            ...prev,
            isChecking: false,
            status: manual ? "Could not check for updates." : prev.status,
          }));
          return;
        }

        const status = info.error
          ? "Could not reach GitHub. Try again later."
          : info.hasUpdate
          ? "Update available."
          : "You’re up to date.";

        set((prev) => ({
          ...prev,
          currentVersion: info.currentVersion,
          latestVersion: info.latestVersion,
          hasUpdate: info.hasUpdate,
          notesPreview: info.notesPreview,
          releaseUrl: info.releaseUrl,
          downloadUrl: info.downloadUrl,
          error: info.error ?? null,
          status: manual ? status : prev.status ?? status,
          isChecking: false,
          cooldownSecondsRemaining: manual ? UPDATE_CHECK_COOLDOWN_SECONDS : prev.cooldownSecondsRemaining,
          shouldShowPrompt: info.hasUpdate || prev.shouldShowPrompt,
        }));
      } catch (error) {
        set((prev) => ({
          ...prev,
          isChecking: false,
          error: error instanceof Error ? error.message : "Unknown error while checking for updates",
          status: manual ? "Could not check for updates." : prev.status,
        }));
      }
    },
    decrementCooldown(amount: number) {
      if (amount <= 0) return;
      set((prev) => ({
        ...prev,
        cooldownSecondsRemaining: Math.max(0, prev.cooldownSecondsRemaining - amount),
      }));
    },
    clearStatus() {
      set((prev) => ({ ...prev, status: null }));
    },
    setStatus(status: string | null) {
      set((prev) => ({ ...prev, status }));
    },
    markPromptSeen() {
      set((prev) => ({ ...prev, shouldShowPrompt: false }));
    },
  };
});

