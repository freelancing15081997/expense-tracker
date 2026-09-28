import React from 'react';
import { css } from '../ui/css.js';

export default function PageLoader({ v }) {
  return (
    <>
      <div style={css("position:absolute;left:50%;top:78px;z-index:30;transform:translateX(-50%);display:flex;align-items:center;gap:10px;height:40px;padding:0 16px 0 8px;border-radius:99px;background:#fff;border:1px solid rgba(16,24,40,.07);box-shadow:0 14px 30px -14px rgba(16,24,40,.35);animation:rise .2s ease both")}>
        <span style={css("width:28px;height:28px;border-radius:9px;background:linear-gradient(150deg,#fff,#E6F6F4);display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(16,24,40,.06)")}>
          <svg viewBox="0 0 58 51" width="19" height="17" fill="none">
            <rect x="0.5" y="42" width="6.5" height="7.5" rx="1.6" fill="#0B1F3A" />
            <rect x="8.5" y="42" width="6.5" height="7.5" rx="1.6" fill="#0B1F3A" />
            <rect x="16.5" y="2" width="10" height="47.5" rx="2.4" fill="#0B1F3A" />
            <path fill="#0B1F3A" fillRule="evenodd" d="M25 18.5H31.5A15.5 15.5 0 0 1 31.5 49.5H25ZM25 27.5H31.5A6.5 6.5 0 0 1 31.5 40.5H25Z" />
            <path style={css("stroke-dasharray:100;animation:bjLoop 1s ease-in-out infinite")} d="M19 42C33.5 41.5 43 34 48.5 17" stroke="#12B8A8" strokeWidth="6.8" strokeLinecap="round" pathLength="100" />
            <path d="M40.6 19.6L57 17.4L50.6 2.4Z" fill="#12B8A8" />
          </svg>
        </span>
        <span style={css("font:550 13px 'Geist';color:#344054")}>
          {"Loading "}{v.modN}
        </span>
        <span style={css("display:flex;gap:3px")}>
          <span style={css("width:4px;height:4px;border-radius:50%;background:#12B8A8;animation:glow .9s infinite")} />
          <span style={css("width:4px;height:4px;border-radius:50%;background:#12B8A8;animation:glow .9s .2s infinite")} />
          <span style={css("width:4px;height:4px;border-radius:50%;background:#12B8A8;animation:glow .9s .4s infinite")} />
        </span>
      </div>
    </>
  );
}
