import { useId } from "react";

// <ByjanLoader size={64} theme="light" />  theme: "light" | "dark". Transparent background, works on any surface.
export default function ByjanLoader({ size = 64, theme = "light", label = "Loading" }) {
  const uid = useId().replace(/:/g, "");
  const ink = theme === "dark" ? "#ffffff" : "#0f1c36";
  const acc = theme === "dark" ? "#2fd3a8" : "#17b18c";
  const dur = "2.8s";
  const pop = { values: "0;0;15;15;0", keyTimes: "0;.44;.52;.84;1" };
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={label}>
      <defs>
        <linearGradient id={uid + "g"} gradientUnits="userSpaceOnUse" x1="62" y1="40" x2="150" y2="176">
          <stop offset="0" stopColor={ink} /><stop offset=".5" stopColor={ink} /><stop offset="1" stopColor={acc} />
        </linearGradient>
        <mask id={uid + "m"} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
          <rect width="200" height="200" fill="#fff" />
          <circle cx="62" cy="40" r="23" fill="#000" />
          <circle cx="114" cy="76" r="0" fill="#000">
            <animate attributeName="r" values="0;0;21;21;0" keyTimes={pop.keyTimes} dur={dur} repeatCount="indefinite" />
          </circle>
        </mask>
      </defs>
      <path d="M62 40V126A50 50 0 1 0 112 76" fill="none" stroke={`url(#${uid}g)`} strokeWidth="24" strokeLinecap="round"
        mask={`url(#${uid}m)`} pathLength="100" strokeDasharray="100 100">
        <animate attributeName="stroke-dashoffset" values="100;0;0;100" keyTimes="0;.5;.84;1" dur={dur}
          repeatCount="indefinite" calcMode="spline" keySplines=".6 0 .3 1;0 0 1 1;.5 0 .5 1" />
      </path>
      <circle cx="62" cy="40" r="12.25" fill="none" stroke={acc} strokeWidth="9.5" />
      <circle cx="114" cy="76" r="0" fill={acc}>
        <animate attributeName="r" {...pop} dur={dur} repeatCount="indefinite" />
      </circle>
      <circle cx="84" cy="84.5" r="5.5" fill={acc} opacity="0">
        <animate attributeName="opacity" values="0;0;.75;.75;0" keyTimes="0;.56;.62;.84;1" dur={dur} repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
