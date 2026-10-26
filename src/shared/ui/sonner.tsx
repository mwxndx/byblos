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
      offset="calc(var(--sat, 0px) + 64px)"
      mobileOffset="calc(var(--sat, 0px) + 64px)"
      expand={false}
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white dark:group-[.toaster]:bg-black group-[.toaster]:text-label group-[.toaster]:border-separator group-[.toaster]:shadow-[var(--shadow-pop)] w-full sm:w-[356px] max-w-full sm:max-w-[400px] border rounded-2xl transition-all duration-200",
          description: "group-[.toast]:text-label-2 text-sm",
          actionButton:
            "group-[.toast]:bg-yellow-400 group-[.toast]:text-slate-950 font-bold",
          cancelButton:
            "group-[.toast]:bg-fill group-[.toast]:text-label",
          title: "text-sm sm:text-base font-bold text-label",
          icon: "w-5 h-5 sm:w-6 sm:h-6"
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
