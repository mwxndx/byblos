// Icon adapter: the whole app keeps importing its familiar (ex-lucide) icon
// names, mapped here to the nearest Phosphor glyph. Phosphor gives Byblos a
// rounded, multi-weight, SF-adjacent look that is MIT-licensed and shippable on
// web + Android (Apple’s SF Symbols are not). One place to remap, not 132 files.
import React, { forwardRef } from 'react';
import type { IconProps } from '@phosphor-icons/react';

export {
  Pulse as Activity,
  WarningCircle as AlertCircle,
  Warning as AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChartBar as BarChart3,
  Bell,
  BellSimple,
  Calendar,
  Check,
  Checks as CheckCheck,
  CheckCircle,
  CheckCircle as CheckCircle2,
  CaretDown as ChevronDown,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  CaretUp as ChevronUp,
  Circle,
  Clock,
  Copy,
  CreditCard,
  CurrencyDollar as DollarSign,
  DownloadSimple as Download,
  PencilSimple as Edit,
  Pencil as Edit2,
  PencilLine as Edit3,
  ArrowSquareOut as ExternalLink,
  Eye,
  EyeSlash as EyeOff,
  FacebookLogo as Facebook,
  FileText,
  Globe,
  Handshake,
  Heart,
  ClockCounterClockwise as History,
  House as Home,
  Image,
  ImageSquare as ImagePlus,
  Info,
  InstagramLogo as Instagram,
  Key as KeyRound,
  LinkSimple as Link2,
  CircleNotch as Loader2,
  Lock,
  SignOut as LogOut,
  Envelope as Mail,
  EnvelopeSimple as MailPlus,
  MapPin,
  Megaphone,
  ChatText as MessageSquare,
  Minus,
  Moon,
  DotsThree as MoreHorizontal,
  CursorClick as MousePointerClick,
  MusicNote as Music,
  MusicNote as Music2,
  NavigationArrow as Navigation,
  Package,
  Package as PackageCheck,
  Package as PackagePlus,
  Package as PackageSearch,
  PencilSimple as Pencil,
  Percent,
  Phone,
  Plus,
  ArrowsClockwise as RefreshCw,
  MagnifyingGlass as Search,
  PaperPlaneTilt as Send,
  GearSix as Settings,
  ShareNetwork as Share2,
  Shield,
  ShieldWarning as ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkle as Sparkles,
  Sun,
  Tote,
  Trash as Trash2,
  Truck,
  ArrowUUpLeft as Undo2,
  CloudArrowUp as UploadCloud,
  User,
  UserCircle,
  UserMinus,
  UserPlus,
  User as UserRound,
  UserFocus as UserRoundPen,
  Users,
  UsersThree,
  VideoCamera as Video,
  Wallet,
  Wallet as WalletCards,
  X,
  XCircle,
} from '@phosphor-icons/react';

// Soft, rounded-corner SVG icons for navigation and high-visibility interfaces
export const Receipt = forwardRef<SVGSVGElement, IconProps>(({ size = 24, color = 'currentColor', weight = 'regular', className, ...props }, ref) => {
  const isFill = weight === 'fill';
  return React.createElement(
    'svg',
    {
      ref,
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 256 256',
      fill: isFill ? color : 'none',
      stroke: isFill ? 'none' : color,
      strokeWidth: isFill ? 0 : 16,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className,
      ...props,
    },
    isFill
      ? React.createElement('path', {
          d: 'M208,32H48A24,24,0,0,0,24,56V208a16,16,0,0,0,24,13.86l14.26-8.23a16,16,0,0,1,16,0l14.26,8.23a16,16,0,0,0,16,0l14.26-8.23a16,16,0,0,1,16,0l14.26,8.23a16,16,0,0,0,16,0l14.26-8.23a16,16,0,0,1,16,0l14.26,8.23a16,16,0,0,0,24-13.86V56A24,24,0,0,0,208,32ZM176,144H80a8,8,0,0,1,0-16h96a8,8,0,0,1,0,16Zm0-32H80a8,8,0,0,1,0-16h96a8,8,0,0,1,0,16Z',
        })
      : React.createElement(
          React.Fragment,
          null,
          React.createElement('path', {
            d: 'M208,32H48A24,24,0,0,0,24,56V208a16,16,0,0,0,24,13.86l14.26-8.23a16,16,0,0,1,16,0l14.26,8.23a16,16,0,0,0,16,0l14.26-8.23a16,16,0,0,1,16,0l14.26,8.23a16,16,0,0,0,16,0l14.26-8.23a16,16,0,0,1,16,0l14.26,8.23a16,16,0,0,0,24-13.86V56A24,24,0,0,0,208,32Z',
          }),
          React.createElement('line', { x1: 80, y1: 104, x2: 176, y2: 104 }),
          React.createElement('line', { x1: 80, y1: 144, x2: 176, y2: 144 })
        )
  );
});
Receipt.displayName = 'Receipt';

export const Store = forwardRef<SVGSVGElement, IconProps>(({ size = 24, color = 'currentColor', weight = 'regular', className, ...props }, ref) => {
  const isFill = weight === 'fill';
  return React.createElement(
    'svg',
    {
      ref,
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 256 256',
      fill: isFill ? color : 'none',
      stroke: isFill ? 'none' : color,
      strokeWidth: isFill ? 0 : 16,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className,
      ...props,
    },
    isFill
      ? React.createElement('path', {
          d: 'M224,96a8,8,0,0,0-1.87-5.18l-18.46-44A24,24,0,0,0,181.54,32H74.46a24,24,0,0,0-22.13,14.82l-18.46,44A8,8,0,0,0,32,96v16a32,32,0,0,0,16,27.71V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V139.71A32,32,0,0,0,224,112ZM144,208H112V160a16,16,0,0,1,32,0Zm48-80a16,16,0,0,1-16-16V96h32v16A16,16,0,0,1,192,128Zm-48,0a16,16,0,0,1-16-16V96h32v16A16,16,0,0,1,144,128ZM96,128a16,16,0,0,1-16-16V96h32v16A16,16,0,0,1,96,128ZM48,112V96H80v16a16,16,0,0,1-32,0Z',
        })
      : React.createElement(
          React.Fragment,
          null,
          React.createElement('path', {
            d: 'M40,96h176a8,8,0,0,1,7.39,11.08l-16,40A16,16,0,0,1,192.54,160H63.46a16,16,0,0,1-14.85-12.92l-16-40A8,8,0,0,1,40,96Z',
          }),
          React.createElement('path', {
            d: 'M56,96,70.54,46.82A16,16,0,0,1,85.89,36h84.22a16,16,0,0,1,15.35,10.82L200,96',
          }),
          React.createElement('rect', { x: 52, y: 144, width: 152, height: 76, rx: 16 }),
          React.createElement('path', { d: 'M104,220V176a16,16,0,0,1,16-16h16a16,16,0,0,1,16,16v44' })
        )
  );
});
Store.displayName = 'Store';

export const ShoppingBag = forwardRef<SVGSVGElement, IconProps>(({ size = 24, color = 'currentColor', weight = 'regular', className, ...props }, ref) => {
  const isFill = weight === 'fill';
  return React.createElement(
    'svg',
    {
      ref,
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 256 256',
      fill: isFill ? color : 'none',
      stroke: isFill ? 'none' : color,
      strokeWidth: isFill ? 0 : 16,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className,
      ...props,
    },
    isFill
      ? React.createElement('path', {
          d: 'M216,72H176a48,48,0,0,0-96,0H40A24,24,0,0,0,16,96V192a32,32,0,0,0,32,32H208a32,32,0,0,0,32-32V96A24,24,0,0,0,216,72ZM128,40a32,32,0,0,1,32,32H96A32,32,0,0,1,128,40Z',
        })
      : React.createElement(
          React.Fragment,
          null,
          React.createElement('rect', { x: 32, y: 72, width: 192, height: 144, rx: 28 }),
          React.createElement('path', { d: 'M88,88V72a40,40,0,0,1,80,0V88' })
        )
  );
});
ShoppingBag.displayName = 'ShoppingBag';

export const TrendingUp = forwardRef<SVGSVGElement, IconProps>(({ size = 24, color = 'currentColor', className, ...props }, ref) => {
  return React.createElement(
    'svg',
    {
      ref,
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 256 256',
      fill: 'none',
      stroke: color,
      strokeWidth: 20,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className,
      ...props,
    },
    React.createElement('path', {
      d: 'M232,56,140.69,147.31a16,16,0,0,1-22.63,0L89.94,119.19a16,16,0,0,0-22.63,0L24,162',
    }),
    React.createElement('polyline', { points: '184 56 232 56 232 104' })
  );
});
TrendingUp.displayName = 'TrendingUp';

// Ex-lucide `LucideIcon` prop type -> Phosphor's component type.
export type { Icon as LucideIcon, IconProps } from '@phosphor-icons/react';
