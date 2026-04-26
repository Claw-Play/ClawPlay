import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon({ className, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ShrimpLogoIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className} viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.12" />
      <path
        d="M14 23.5c0-5.5 4.5-10 10-10 4.4 0 8 2.5 9.5 6.1-2.8-.7-4.7-.2-6.1.8 2.7.3 4.4 1.5 5.5 3.6-2.1-.7-3.8-.5-5.2.5 1.9.4 3.1 1.3 3.8 2.8-1.8-.5-3.2-.4-4.4.3-1.5 1-3.2 1.4-5.1 1.4-4.7 0-8.4-2.5-8.4-5.5Z"
        fill="currentColor"
      />
      <path d="M33.5 19.4c2.1-1.2 4.2-1.5 6.5-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M33.5 23.8c1.8-.2 3.4.1 4.8 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M33 28c1.4.1 2.6.5 3.8 1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18.2" cy="21.8" r="1.2" fill="#fffdf7" />
    </BaseIcon>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 19V5m0 14h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="6.5" y="12.5" width="3" height="6" rx="0.9" fill="currentColor" />
      <rect x="11" y="8.5" width="3" height="10" rx="0.9" fill="currentColor" opacity="0.8" />
      <rect x="15.5" y="10.5" width="3" height="8" rx="0.9" fill="currentColor" opacity="0.6" />
    </BaseIcon>
  );
}

export function ReviewIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="5" y="4.5" width="14" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.2 5.4 19 8.2l-6.1 6.1-2.7.6.6-2.7 5.4-5.4Z" fill="currentColor" opacity="0.85" />
    </BaseIcon>
  );
}

export function EventsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 12a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
      <path d="M11 12a1 1 0 1 1 2 0" fill="currentColor" />
      <path d="M12 5v2M19 12h-2M5 12H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="9" cy="9" r="3" fill="currentColor" opacity="0.85" />
      <path d="M4.8 18c.8-2.4 2.7-3.6 4.2-3.6s3.4 1.2 4.2 3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="10" r="2.5" fill="currentColor" opacity="0.55" />
      <path d="M13.1 18c.5-1.8 1.8-2.7 2.9-2.7s2.3.9 2.8 2.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function AuditIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function ProvidersIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 8a4 4 0 1 1 8 0c0 4-2 8-4 8s-4-4-4-8Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11 8h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 16v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 12h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M19 12H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 12l4.2 4.2L19 6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 12h16M12 4c2.4 2.4 2.4 13.6 0 16M12 4c-2.4 2.4-2.4 13.6 0 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <BaseIcon {...props} stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" />
      <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
    </BaseIcon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <BaseIcon {...props} style={{ transform: "translate(1px, -1px)" }}>
      <path
        d="M13.5 7.5l3 3M4 20v-3.5L15.293 5.207a1 1 0 0 1 1.414 0l2.086 2.086a1 1 0 0 1 0 1.414L7.5 20H4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m12 4 2.6 5.3 5.9.8-4.3 4.2 1 5.9L12 17.5 6.8 20.2l1-5.9L3.5 10l5.9-.8L12 4Z" fill="currentColor" />
    </BaseIcon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="5" y="6.5" width="14" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 4.5v4M16 4.5v4M5 10h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 4.5h7l3 3V19H7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 4.5V8h3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 11h6M9 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 15.5 7.5 17a4 4 0 1 1-5.6-5.7l2.1-2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 8.5 16.5 7a4 4 0 1 1 5.6 5.7l-2.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.5 14.5 14.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 4 3.8 18h16.4L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </BaseIcon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M17.8 6.2l-1.4 1.4M7.6 16.4l-1.4 1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function SubmitIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 12 20 4 16 20l-4-6-4 2-4-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function AdminShieldIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 4 18 6v5c0 4-2.4 6.9-6 9-3.6-2.1-6-5-6-9V6l6-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 12 11 13.5 14.8 9.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 8l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="5" y="5" width="6" height="6" rx="1.2" fill="currentColor" />
      <rect x="13" y="5" width="6" height="6" rx="1.2" fill="currentColor" opacity="0.7" />
      <rect x="5" y="13" width="6" height="6" rx="1.2" fill="currentColor" opacity="0.7" />
      <rect x="13" y="13" width="6" height="6" rx="1.2" fill="currentColor" opacity="0.5" />
    </BaseIcon>
  );
}

export function TrendingIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 16 10 10l4 4 6-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 4h10v16l-5-3-5 3V4Z" fill="currentColor" opacity="0.85" />
    </BaseIcon>
  );
}

export function NewSparkleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3.5 13.9 9l5.5 1.9-5.5 1.9L12 18.3 10.1 12.8 4.6 10.9 10.1 9 12 3.5Z" fill="currentColor" />
    </BaseIcon>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 6.5h15v9h-8l-4.5 3v-3h-2.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 10h8M8 12.8h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function ChatInstallIcon(props: IconProps) {
  return (
    <BaseIcon {...props} style={{ transform: "translateY(1px)" }}>
      <path
        d="M5.5 6.5A2.5 2.5 0 0 1 8 4h8a2.5 2.5 0 0 1 2.5 2.5v6A2.5 2.5 0 0 1 16 15H11l-3.5 3V15H8a2.5 2.5 0 0 1-2.5-2.5v-6Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.5 9.2h7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8.5 11.9h4.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4.5" y="5" width="15" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 9.2 11 12l-3 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 14.8h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4.5" y="5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.3" fill="currentColor" />
      <path d="M6.5 17 11 12.5l2.5 2.5 2-2 2.5 4H6.5Z" fill="currentColor" opacity="0.75" />
    </BaseIcon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" opacity="0.8" />
    </BaseIcon>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="8.5" cy="10.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11.5 10.5H20l-2 2h-2l-1.3 1.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.8 12.5V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </BaseIcon>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M13 2.5 5.5 13h5L10 21.5 18.5 10h-5L13 2.5Z" fill="currentColor" />
    </BaseIcon>
  );
}

export function GiftIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4.5" y="9" width="15" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 12h15M12 9v10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.2 8.8c-1.6-1.3-2.1-3.1-1.2-4 1.1-1 3.1-.1 4.1 2v2m1.7-2c1-2.1 3-3 4.1-2 .9.9.4 2.7-1.2 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function RobotIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="6" y="8" width="12" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4.5v3.2M9.5 12h.01M14.5 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="4.5" r="1" fill="currentColor" />
    </BaseIcon>
  );
}
