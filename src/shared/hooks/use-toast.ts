import type { ReactNode } from "react";
import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive";

type ToastAction = {
  label: ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

type ToastOptions = {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  duration?: number;
  action?: ToastAction;
};

type ToastUpdateOptions = Omit<ToastOptions, "id">;

const getToastContent = ({ title, description }: ToastOptions) => {
  if (title && description) {
    return { message: title, options: { description } };
  }

  return {
    message: title || description || "",
    options: description ? { description } : undefined,
  };
};

const recentToasts = new Map<string, number>();
const TOAST_DEDUP_WINDOW_MS = 1200;

function isDuplicateToast(key: string): boolean {
  const now = Date.now();
  const lastTime = recentToasts.get(key) || 0;
  if (now - lastTime < TOAST_DEDUP_WINDOW_MS) {
    return true;
  }
  recentToasts.set(key, now);
  if (recentToasts.size > 50) {
    for (const [k, time] of recentToasts.entries()) {
      if (now - time > 5000) recentToasts.delete(k);
    }
  }
  return false;
}

function toast(props: ToastOptions) {
  const { id, variant, duration, action } = props;
  const { message, options } = getToastContent(props);
  const toastOptions = { ...options, id, duration, action };

  const messageStr = typeof message === 'string' ? message : '';
  const descStr = typeof options?.description === 'string' ? options.description : '';
  const dedupKey = `${variant || 'default'}:${messageStr}:${descStr}`;
  if (dedupKey !== 'default::' && isDuplicateToast(dedupKey)) {
    return {
      id: '',
      dismiss: () => {},
      update: () => {},
    };
  }

  const toastId = variant === "destructive"
    ? sonnerToast.error(message, toastOptions)
    : sonnerToast(message, toastOptions);

  return {
    id: String(toastId),
    dismiss: () => sonnerToast.dismiss(toastId),
    update: (nextProps: ToastUpdateOptions) => {
      const next = getToastContent(nextProps);
      const nextOptions = {
        ...next.options,
        id: toastId,
        duration: nextProps.duration,
      };

      return nextProps.variant === "destructive"
        ? sonnerToast.error(next.message, nextOptions)
        : sonnerToast(next.message, nextOptions);
    },
  };
}

toast.success = (message: ReactNode, options?: Parameters<typeof sonnerToast.success>[1]) => {
  const key = `success:${typeof message === 'string' ? message : ''}`;
  if (isDuplicateToast(key)) return '';
  return sonnerToast.success(message, options);
};
toast.error = (message: ReactNode, options?: Parameters<typeof sonnerToast.error>[1]) => {
  const key = `error:${typeof message === 'string' ? message : ''}`;
  if (isDuplicateToast(key)) return '';
  return sonnerToast.error(message, options);
};
toast.info = (message: ReactNode, options?: Parameters<typeof sonnerToast.info>[1]) => {
  const key = `info:${typeof message === 'string' ? message : ''}`;
  if (isDuplicateToast(key)) return '';
  return sonnerToast.info(message, options);
};
toast.warning = (message: ReactNode, options?: Parameters<typeof sonnerToast.warning>[1]) => {
  const key = `warning:${typeof message === 'string' ? message : ''}`;
  if (isDuplicateToast(key)) return '';
  return sonnerToast.warning(message, options);
};
toast.promise = sonnerToast.promise;
toast.dismiss = (toastId?: string | number) => sonnerToast.dismiss(toastId);

function useToast() {
  return {
    toasts: [],
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  };
}

export { useToast, toast };


