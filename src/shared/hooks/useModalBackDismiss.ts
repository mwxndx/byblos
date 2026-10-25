import { useEffect } from 'react';
import { registerModalDismiss } from '@/shared/utils/modalBackHandler';

/**
 * Custom hook to bind modal close / dismissal to the mobile back button.
 * When `isOpen` is true, registers a dismiss callback on the modalBackHandler stack.
 * Prevents Android hardware/gesture back buttons from exiting the app while a modal is open.
 *
 * @param isOpen Whether the modal or overlay is currently visible.
 * @param onDismiss Callback invoked when the user taps back.
 */
export function useModalBackDismiss(isOpen: boolean, onDismiss: () => void): void {
  useEffect(() => {
    if (!isOpen) return;

    return registerModalDismiss(() => {
      onDismiss();
      return true;
    });
  }, [isOpen, onDismiss]);
}
