import React from 'react';
import { css } from '../ui/css.js';

export default function Toast({ v }) {
  return (
    <>
      <div style={css("position:absolute;left:50%;bottom:28px;z-index:50;transform:translateX(-50%);display:flex;align-items:center;gap:12px;max-width:calc(100% - 32px);padding:12px 12px 12px 16px;border-radius:14px;background:#fff;color:#101828;border:1px solid rgba(16,24,40,.08);box-shadow:0 24px 48px -20px rgba(16,24,40,.35);animation:rise .25s ease both")}>
        <span style={css(`display:grid;color:${v.toastC??""}`)}>
          <span style={css(`flex:none;width:18px;height:18px;background:currentColor;-webkit-mask:url(${v.toastIc??""}) center/contain no-repeat;mask:url(${v.toastIc??""}) center/contain no-repeat;`)} />
        </span>
        <span style={css("font:500 13.5px 'Geist'")}>
          {v.toastT}
        </span>
        {v.hasUndo ? (<>
          <span style={css("height:30px;padding:0 12px;border-radius:8px;background:#E6FAF6;display:grid;place-items:center;font:650 12.5px 'Geist';color:#0B6B61;cursor:pointer")} onClick={v.undo}>
            Undo
          </span>
        </>) : null}
        <span style={css("display:grid;cursor:pointer;opacity:.6")} onClick={v.closeToast}>
          <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;")} />
        </span>
      </div>
    </>
  );
}
