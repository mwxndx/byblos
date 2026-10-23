import { App } from '@capacitor/app';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import apiClient from '@/infrastructure/http/apiClient';

export interface AppVersionPolicy {
  platform: 'android' | 'web';
  minAndroidVersionCode: number;
  latestAndroidVersionCode: number;
  latestVersionName: string;
  forceUpdate: boolean;
  storeUrl: string;
  webStoreUrl: string;
  releaseNotes?: string[];
}

export interface AppVersionStatus {
  isSupported: boolean;
  updateRequired: boolean;
  installedVersionCode: number | null;
  installedVersionName: string | null;
  policy: AppVersionPolicy | null;
}

export async function checkAppVersion(
  fetchPolicyFn = async (): Promise<AppVersionPolicy> => {
    const res = await apiClient.get<{ data: AppVersionPolicy }>('/public/app-version');
    return res.data?.data;
  },
  getInfoFn = async () => {
    return App.getInfo();
  }
): Promise<AppVersionStatus> {
  // Web and iOS PWA sessions are never blocked by Android version gates
  if (!isNativeApp()) {
    return {
      isSupported: true,
      updateRequired: false,
      installedVersionCode: null,
      installedVersionName: null,
      policy: null,
    };
  }

  try {
    const [policy, info] = await Promise.all([
      fetchPolicyFn(),
      getInfoFn(),
    ]);

    const installedVersionCode = parseInt(info?.build || '0', 10);
    const minVersionCode = policy?.minAndroidVersionCode ?? 0;
    const forceUpdate = policy?.forceUpdate ?? true;

    const updateRequired = Boolean(
      forceUpdate && installedVersionCode > 0 && installedVersionCode < minVersionCode
    );

    return {
      isSupported: !updateRequired,
      updateRequired,
      installedVersionCode,
      installedVersionName: info?.version || null,
      policy,
    };
  } catch (error) {
    // If backend is unreachable or device is offline, fail open so user is not blocked
    console.warn('[AppVersionService] Failed to check app version:', error);
    return {
      isSupported: true,
      updateRequired: false,
      installedVersionCode: null,
      installedVersionName: null,
      policy: null,
    };
  }
}

export function openPlayStore(storeUrl = 'market://details?id=space.bybloshq.app') {
  try {
    window.location.href = storeUrl;
  } catch {
    window.open('https://play.google.com/store/apps/details?id=space.bybloshq.app', '_system');
  }
}
