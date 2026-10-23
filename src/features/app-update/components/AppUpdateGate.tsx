import { useEffect, useState } from 'react';
import { checkAppVersion, openPlayStore, type AppVersionPolicy } from '../services/appVersionService';
import { registerModalDismiss } from '@/shared/utils/modalBackHandler';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';

export function AppUpdateGate() {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [policy, setPolicy] = useState<AppVersionPolicy | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;

    let mounted = true;
    checkAppVersion().then((status) => {
      if (mounted && status.updateRequired) {
        setUpdateRequired(true);
        setPolicy(status.policy);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Trap the Android hardware back button so it does NOT dismiss the update gate
  useEffect(() => {
    if (!updateRequired) return;

    // Returning true tells modalBackHandler that this modal handled the back press (preventing bypass)
    const unregister = registerModalDismiss(() => true);
    return () => {
      unregister();
    };
  }, [updateRequired]);

  if (!updateRequired) {
    return null;
  }

  const handleUpdateClick = () => {
    openPlayStore(policy?.storeUrl);
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-required-title"
      aria-describedby="update-required-desc"
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-between bg-white dark:bg-black p-6 select-none animate-in fade-in duration-300"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 24px) + 24px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 24px) + 24px)',
      }}
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm w-full mx-auto">
        <div className="w-20 h-20 mb-6 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center shadow-xl">
          <span className="text-white dark:text-black font-black text-3xl tracking-tighter">BY</span>
        </div>

        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 mb-4">
          Update Required
        </span>

        <h1 id="update-required-title" className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight mb-3">
          New Version Available
        </h1>

        <p id="update-required-desc" className="text-sm text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
          To continue using Byblos, please update to version{' '}
          <span className="font-semibold text-slate-900 dark:text-zinc-200">
            {policy?.latestVersionName || 'latest'}
          </span>
          . This release contains essential updates and performance improvements.
        </p>

        {policy?.releaseNotes && policy.releaseNotes.length > 0 && (
          <div className="w-full bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-4 text-left mb-6">
            <h2 className="text-xs font-bold text-slate-900 dark:text-zinc-200 uppercase tracking-wider mb-2">
              What's New:
            </h2>
            <ul className="text-xs text-slate-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside">
              {policy.releaseNotes.map((note, idx) => (
                <li key={idx} className="leading-snug">{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm mx-auto space-y-3">
        <button
          type="button"
          onClick={handleUpdateClick}
          className="w-full py-3.5 px-6 rounded-xl bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-black font-semibold text-base shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span>Update on Google Play</span>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 3l14 9-14 9V3z"/>
          </svg>
        </button>
        <p className="text-center text-[11px] text-slate-400 dark:text-zinc-500">
          Google Play Store will open automatically
        </p>
      </div>
    </div>
  );
}
