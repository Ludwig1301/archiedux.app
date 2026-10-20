function Svg({ children, className = "h-4 w-4", ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function MicIcon(props) {
  return (
    <Svg {...props}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 10.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17v4M8.5 21h7" />
    </Svg>
  );
}

export function PlayIcon(props) {
  return (
    <Svg {...props}>
      <path d="M8 5.5v13l10-6.5z" />
    </Svg>
  );
}

export function PauseIcon(props) {
  return (
    <Svg {...props}>
      <path d="M8 5v14M16 5v14" />
    </Svg>
  );
}

export function StopIcon(props) {
  return (
    <Svg {...props}>
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </Svg>
  );
}

export function DownloadIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3v12" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4 20h16" />
    </Svg>
  );
}

export function UploadIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 20h16" />
    </Svg>
  );
}

export function UsersIcon(props) {
  return (
    <Svg {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5.5a4 4 0 0 0-4 4v2" />
      <circle cx="8.75" cy="7" r="4" />
      <path d="M22.5 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

export function SparklesIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3l1.35 3.9L17.5 8.3l-4.15 1.4L12 13.6l-1.35-3.9L6.5 8.3l4.15-1.4z" />
      <path d="M19 14l.7 2.05L21.8 16.8l-2.1.75L19 19.6l-.7-2.05-2.1-.75 2.1-.75z" />
      <path d="M5 15l.55 1.65L7.2 17.2l-1.65.55L5 19.4l-.55-1.65-1.65-.55 1.65-.55z" />
    </Svg>
  );
}

export function VideoIcon(props) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="5.5" width="13" height="13" rx="2" />
      <path d="m15.5 10.5 6-3.5v10l-6-3.5" />
    </Svg>
  );
}

export function ArrowRightIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 12h16" />
      <path d="m14.5 6.5 5.5 5.5-5.5 5.5" />
    </Svg>
  );
}

export function ChevronDownIcon(props) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function CheckIcon(props) {
  return (
    <Svg {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Svg>
  );
}

export function XIcon(props) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

export function SpeakerIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
    </Svg>
  );
}

export function ResetIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 11.5a8.5 8.5 0 1 0 2.8-6.3" />
      <path d="M3.5 4.5v6h6" />
    </Svg>
  );
}

export function CopyIcon(props) {
  return (
    <Svg {...props}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5v-4a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h4" />
    </Svg>
  );
}

export function MenuIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function GlobeIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </Svg>
  );
}

export function FilmIcon(props) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="M7 4.5v15M17 4.5v15M2.5 9.5h19M2.5 14.5h19" />
    </Svg>
  );
}

export function GamepadIcon(props) {
  return (
    <Svg {...props}>
      <path d="M7 8h10a4 4 0 0 1 3.8 5.2l-1.2 3.5a2.4 2.4 0 0 1-4.1.8L14 16h-4l-1.5 1.5a2.4 2.4 0 0 1-4.1-.8l-1.2-3.5A4 4 0 0 1 7 8z" />
      <path d="M7.5 11v3M6 12.5h3M16.5 11.5h.01M18.5 13.5h.01" />
    </Svg>
  );
}

export function WandIcon(props) {
  return (
    <Svg {...props}>
      <path d="m4 20 11-11" />
      <path d="m14 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
      <path d="m19 11 .7 1.4 1.4.7-1.4.7L19 15.2l-.7-1.4-1.4-.7 1.4-.7z" />
      <path d="m5 4 .7 1.4L7.1 6.1l-1.4.7L5 8.2l-.7-1.4-1.4-.7 1.4-.7z" />
    </Svg>
  );
}

export function ShieldIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3 20 6v5.5c0 5-3.2 8.2-8 9.5-4.8-1.3-8-4.5-8-9.5V6z" />
      <path d="m8.5 12 2.3 2.3 4.7-5" />
    </Svg>
  );
}

export function ClockIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Svg>
  );
}

export function PlusIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function MinusIcon(props) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function HeadphonesIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2zM20 14a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z" />
    </Svg>
  );
}

export function RadioIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="2.2" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
    </Svg>
  );
}

export function StarIcon(props) {
  return (
    <Svg {...props}>
      <path d="m12 3.5 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />
    </Svg>
  );
}

export function LockIcon(props) {
  return (
    <Svg {...props}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </Svg>
  );
}

export function ListIcon(props) {
  return (
    <Svg {...props}>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </Svg>
  );
}

export function HelpIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.35-1 1-1 1.7v.5M12 17h.01" />
    </Svg>
  );
}
