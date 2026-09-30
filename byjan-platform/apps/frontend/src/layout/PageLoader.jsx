import React from 'react';
import ByjanLoader from '../brand/ByjanLoader.jsx';
import { css } from '../ui/css.js';

export default function PageLoader({ v }) {
  return (
    <>
      <div style={css("position:absolute;left:50%;top:78px;z-index:30;transform:translateX(-50%);display:flex;align-items:center;gap:10px;height:40px;padding:0 16px 0 8px;border-radius:99px;background:#fff;border:1px solid rgba(16,24,40,.07);box-shadow:0 14px 30px -14px rgba(16,24,40,.35);animation:rise .2s ease both")}>
        <span style={css("width:28px;height:28px;display:grid;place-items:center")}>
          <ByjanLoader size={26} />
        </span>
        <span style={css("font:550 13px 'Geist';color:#344054")}>
          {"Loading "}{v.modN}
        </span>
        <span style={css("display:flex;gap:3px")}>
          <span style={css("width:4px;height:4px;border-radius:50%;background:#17b18c;animation:glow .9s infinite")} />
          <span style={css("width:4px;height:4px;border-radius:50%;background:#17b18c;animation:glow .9s .2s infinite")} />
          <span style={css("width:4px;height:4px;border-radius:50%;background:#17b18c;animation:glow .9s .4s infinite")} />
        </span>
      </div>
    </>
  );
}
