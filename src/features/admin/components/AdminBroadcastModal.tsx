import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Loader2, Send, CheckCircle2, AlertCircle, RefreshCw } from '@/shared/ui/icons';
import { adminApi, type BroadcastUpdateResult } from '@/features/admin/api';
import { classifyApiError } from '@/shared/utils/errorClassification';
import { registerModalDismiss } from '@/shared/utils/modalBackHandler';
import { toast } from 'sonner';

interface AdminBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminBroadcastModal({ isOpen, onClose }: AdminBroadcastModalProps) {
  const [minVersionCode, setMinVersionCode] = useState<number>(70);
  const [title, setTitle] = useState<string>('Update Available: Byblos 1.0.70');
  const [body, setBody] = useState<string>(
    'A new version of Byblos is available. Please update now to continue using all features.'
  );
  const [storeUrl, setStoreUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<BroadcastUpdateResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    return registerModalDismiss(() => {
      onClose();
      return true;
    });
  }, [isOpen, onClose]);

  const handleReset = () => {
    setResult(null);
    setMinVersionCode(70);
    setTitle('Update Available: Byblos 1.0.70');
    setBody('A new version of Byblos is available. Please update now to continue using all features.');
    setStoreUrl('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    handleReset();
    onClose();
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (minVersionCode <= 0) {
      toast.error('Minimum version code must be greater than 0');
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await adminApi.broadcastAppUpdate({
        minVersionCode: Number(minVersionCode),
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        storeUrl: storeUrl.trim() || undefined,
      });

      setResult(data);
      toast.success('App update broadcast sent successfully!');
    } catch (error) {
      toast.error(classifyApiError(error, 'Failed to broadcast app update').message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md p-6 bg-surface-1 border border-separator rounded-3xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
              <Send className="w-4 h-4" />
            </div>
            <DialogTitle className="text-lg font-bold text-label">Broadcast App Update</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-label-2">
            Send an instant push notification and in-app update banner to users running outdated versions of Byblos.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-400">Broadcast Dispatched</p>
                <p className="text-xs text-label-2 mt-0.5">
                  Update notifications targeted devices with version code &lt; {result.minVersionCode}.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-fill border border-separator text-center">
                <p className="text-[11px] text-label-3 uppercase tracking-wider font-semibold">Target Devices</p>
                <p className="text-xl font-bold text-label mt-1">{result.targetedDevices}</p>
              </div>
              <div className="p-3 rounded-xl bg-fill border border-separator text-center">
                <p className="text-[11px] text-label-3 uppercase tracking-wider font-semibold">In-App Alerts</p>
                <p className="text-xl font-bold text-label mt-1">{result.inAppNotificationsCreated}</p>
              </div>
              <div className="p-3 rounded-xl bg-fill border border-separator text-center">
                <p className="text-[11px] text-label-3 uppercase tracking-wider font-semibold">FCM Sent</p>
                <p className="text-xl font-bold text-green-400 mt-1">{result.fcmSent}</p>
              </div>
              <div className="p-3 rounded-xl bg-fill border border-separator text-center">
                <p className="text-[11px] text-label-3 uppercase tracking-wider font-semibold">FCM Failed</p>
                <p className="text-xl font-bold text-label-3 mt-1">{result.fcmFailed}</p>
              </div>
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full h-11 rounded-xl text-xs font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Broadcast Again
              </Button>
              <Button
                onClick={handleClose}
                className="w-full h-11 bg-white hover:bg-gray-100 text-black border border-gray-200 rounded-xl text-xs font-semibold shadow-sm"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleBroadcast} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="minVersionCode" className="text-xs font-semibold text-label">
                Target Minimum Version Code
              </Label>
              <Input
                id="minVersionCode"
                type="number"
                min={1}
                value={minVersionCode}
                onChange={(e) => setMinVersionCode(parseInt(e.target.value, 10) || 0)}
                disabled={isSubmitting}
                className="h-10 text-sm bg-fill border-separator rounded-xl"
                required
              />
              <p className="text-[11px] text-label-3">
                Android devices reporting a version code lower than this will be targeted.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notificationTitle" className="text-xs font-semibold text-label">
                Notification Title
              </Label>
              <Input
                id="notificationTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                className="h-10 text-sm bg-fill border-separator rounded-xl"
                placeholder="Update Available: Byblos 1.0.70"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notificationBody" className="text-xs font-semibold text-label">
                Notification Message
              </Label>
              <textarea
                id="notificationBody"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                className="w-full px-3 py-2 text-sm bg-fill border border-separator rounded-xl text-label focus:outline-none focus:ring-1 focus:ring-yellow-400 resize-none"
                placeholder="A new version of Byblos is available..."
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="storeUrl" className="text-xs font-semibold text-label">
                Store or Download URL (Optional)
              </Label>
              <Input
                id="storeUrl"
                type="url"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                disabled={isSubmitting}
                className="h-10 text-sm bg-fill border-separator rounded-xl"
                placeholder="Leave blank to use default download link"
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-label-2 leading-relaxed">
                This triggers a broadcast push notification and queues persistent in-app notifications for all matching device tokens.
              </p>
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 bg-white hover:bg-gray-100 text-black border border-gray-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Broadcasting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Broadcast Update
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
