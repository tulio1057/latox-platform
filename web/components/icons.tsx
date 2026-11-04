import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 24): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
});

export const IconArrow = ({ size, ...p }: P) => (
  <svg {...base(size ?? 18)} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconExternal = ({ size, ...p }: P) => (
  <svg {...base(size ?? 16)} {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
export const IconMenu = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </svg>
);
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconFlask = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" />
    <path d="M7 15h10" />
  </svg>
);
export const IconCalendar = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
export const IconLeaf = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" />
    <path d="M5 19c3-4 6-7 10-9" />
  </svg>
);
export const IconNews = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 4h11a1 1 0 0 1 1 1v14a1 1 0 0 0 1 1H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Z" />
    <path d="M17 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h3" />
  </svg>
);
export const IconUsers = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4M16 4.8a3.2 3.2 0 0 1 0 6.3M18 14.8c1.7.6 2.8 2.4 3 5.2" />
  </svg>
);
export const IconPin = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
export const IconMail = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
export const IconInstagram = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.3" cy="6.7" r="0.8" fill="currentColor" />
  </svg>
);
export const IconInfo = ({ size, ...p }: P) => (
  <svg {...base(size ?? 20)} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const IconFile = ({ size, ...p }: P) => (
  <svg {...base(size ?? 18)} {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);
export const IconMolecule = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 4.5 18.5 8.2v7.6L12 19.5l-6.5-3.7V8.2L12 4.5Z" />
    <circle cx="12" cy="4.5" r="1.6" fill="currentColor" />
    <circle cx="18.5" cy="8.2" r="1.6" fill="currentColor" />
    <circle cx="18.5" cy="15.8" r="1.6" fill="currentColor" />
    <circle cx="12" cy="19.5" r="1.6" fill="currentColor" />
    <circle cx="5.5" cy="15.8" r="1.6" fill="currentColor" />
    <circle cx="5.5" cy="8.2" r="1.6" fill="currentColor" />
  </svg>
);
