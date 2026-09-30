import { useId } from "react";

// <ByjanMark size={40} theme="light" />  Static Trace · Closed loop symbol
export default function ByjanMark({ size = 40, theme = "light", title = "byjan" }) {
  const uid = useId().replace(/:/g, "");
  const ink = theme === "dark" ? "#ffffff" : "#0f1c36";
  const acc = theme === "dark" ? "#2fd3a8" : "#17b18c";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={title}>
      <defs>
        <linearGradient id={uid + "g"} gradientUnits="userSpaceOnUse" x1="62" y1="40" x2="150" y2="176">
          <stop offset="0" stopColor={ink} /><stop offset=".5" stopColor={ink} /><stop offset="1" stopColor={acc} />
        </linearGradient>
        <mask id={uid + "m"} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
          <rect width="200" height="200" fill="#fff" />
          <circle cx="62" cy="40" r="23" fill="#000" /><circle cx="114" cy="76" r="21" fill="#000" />
        </mask>
      </defs>
      <path d="M62 40V126A50 50 0 1 0 112 76" fill="none" stroke={`url(#${uid}g)`} strokeWidth="24" strokeLinecap="round" mask={`url(#${uid}m)`} />
      <circle cx="62" cy="40" r="12.25" fill="none" stroke={acc} strokeWidth="9.5" />
      <circle cx="114" cy="76" r="15" fill={acc} />
      <circle cx="84" cy="84.5" r="5.5" fill={acc} opacity=".75" />
    </svg>
  );
}
