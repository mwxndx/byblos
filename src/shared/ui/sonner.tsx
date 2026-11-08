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
      mobileOffset={{ top: "calc(var(--sat, 0px) + 16px)", left: "16px", right: "16px" }}
      expand={false}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white dark:group-[.toaster]:bg-[#121212] [data-theme=light]_&:bg-white [data-theme=dark]_&:bg-[#121212] text-slate-900 dark:text-white [data-theme=light]_&:text-slate-900 [data-theme=dark]_&:text-white border-slate-200 dark:border-white/10 [data-theme=light]_&:border-slate-200 [data-theme=dark]_&:border-white/10 shadow-lg dark:shadow-2xl w-full sm:w-[356px] max-w-full sm:max-w-[400px] border rounded-2xl transition-all duration-200 p-4",
          description: "text-slate-500 dark:text-neutral-400 [data-theme=light]_&:text-slate-500 [data-theme=dark]_&:text-neutral-400 text-sm mt-1",
          actionButton:
            "bg-black text-white dark:bg-white dark:text-black [data-theme=light]_&:bg-black [data-theme=light]_&:text-white [data-theme=dark]_&:bg-white [data-theme=dark]_&:text-black font-semibold text-xs px-3 py-1.5 rounded-lg",
          cancelButton:
            "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/80 [data-theme=light]_&:bg-slate-100 [data-theme=dark]_&:bg-white/10 text-xs px-3 py-1.5 rounded-lg",
          title: "text-sm sm:text-base font-semibold text-slate-900 dark:text-white [data-theme=light]_&:text-slate-900 [data-theme=dark]_&:text-white",
          icon: "w-5 h-5 sm:w-5 sm:h-5 text-current",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
