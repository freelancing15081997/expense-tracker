import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';

const PH = 'https://unpkg.com/@phosphor-icons/core@2.1.1/assets/';
const Ic = ({ n }) => <span style={{ flex: 'none', width: 16, height: 16, background: 'currentColor', WebkitMask: `url(${PH + n}) center/contain no-repeat`, mask: `url(${PH + n}) center/contain no-repeat` }} />;

export default function ProfileMenu({ v }) {
  return (
    <div style={css("position:absolute;inset:0;z-index:44")}>
      <div style={css("position:absolute;inset:0")} onClick={v.togglePm} />
      <div role="menu" style={css("position:absolute;left:10px;bottom:70px;width:280px;padding:8px;background:#fff;border:1px solid rgba(16,24,40,.07);border-radius:18px;box-shadow:0 24px 50px -20px rgba(11,31,58,.45);animation:zoomIn .15s ease both")}>
        <div style={css("padding:10px 10px 12px;border-bottom:1px solid #F2F4F7;margin-bottom:6px")}>
          <p style={css("font:600 13.5px 'Geist'")}>{v.me?.n}</p>
          <p style={css("margin-top:2px;font:500 12px 'Geist';color:#667085")}>{v.meSub}</p>
        </div>
        {v.pmItems.map(m => (
          <Hx key={m.n} as="div" role="menuitem" s="display:flex;align-items:center;gap:10px;padding:10px;border-radius:11px;cursor:pointer;font:500 13.5px 'Geist';color:#344054" h="background:#F5F6F8" onClick={m.go}>
            <Ic n={m.ic} /><span style={css("flex:1")}>{m.n}</span>
          </Hx>
        ))}
        <div style={css("height:1px;background:#F2F4F7;margin:6px 0")} />
        <Hx as="div" role="menuitem" s="display:flex;align-items:center;gap:10px;padding:10px;border-radius:11px;cursor:pointer;font:600 13.5px 'Geist';color:#B42318" h="background:#FEF3F2" onClick={v.signOut}>
          <Ic n="regular/sign-out.svg" /><span style={css("flex:1")}>Sign out</span>
        </Hx>
      </div>
    </div>
  );
}
