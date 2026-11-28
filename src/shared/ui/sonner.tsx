import { useAppTheme } from "@/shared/hooks/useAppTheme";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useAppTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      offset="calc(var(--sat, env(safe-area-inset-top, 0px)) + 64px)"
      mobileOffset={{
        top: "calc(var(--sat, env(safe-area-inset-top, 0px)) + 16px)",
        left: "16px",
        right: "16px",
      }}
      expand={false}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface-1 text-label border-separator shadow-[var(--shadow-pop)] w-full sm:w-[356px] max-w-full sm:max-w-[400px] border rounded-card transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 p-4",
          description: "text-label-2 text-sm mt-1",
          actionButton:
            "bg-label text-[var(--bg)] font-semibold text-xs px-3 py-1.5 rounded-control",
          cancelButton:
            "bg-fill text-label text-xs px-3 py-1.5 rounded-control",
          title: "text-sm sm:text-base font-semibold text-label",
          icon: "w-5 h-5 text-current",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
