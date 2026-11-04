import type { ReactNode } from "react";

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const OverviewIcon = () => (
  <Svg><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>
);
export const BoxIcon = () => (
  <Svg><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></Svg>
);
export const ClipboardIcon = () => (
  <Svg><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></Svg>
);
export const PulseIcon = () => (
  <Svg><path d="M3 12h4l2-6 4 12 2-6h6" /></Svg>
);
export const PlusIcon = () => (<Svg size={16}><path d="M12 5v14M5 12h14" /></Svg>);
export const SearchIcon = () => (<Svg size={16}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>);
export const DownloadIcon = () => (<Svg size={16}><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></Svg>);
export const CloseIcon = () => (<Svg size={18}><path d="M6 6l12 12M18 6 6 18" /></Svg>);
export const TrashIcon = () => (<Svg size={16}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>);
export const CheckIcon = () => (<Svg size={16}><path d="m5 12 5 5 9-10" /></Svg>);
export const AlertIcon = () => (<Svg size={16}><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4M12 17.5v.01" /></Svg>);
export const ChevronIcon = () => (<Svg size={16}><path d="m9 6 6 6-6 6" /></Svg>);
export const SortIcon = () => (<Svg size={12}><path d="m8 10 4-4 4 4M8 14l4 4 4-4" /></Svg>);
