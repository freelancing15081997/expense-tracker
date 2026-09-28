import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';

export default function SidebarFlyout({ v }) {
  return (
    <>
      <div style={css(`position:absolute;left:92px;top:${v.hov?.y??""};z-index:75;min-width:230px;padding:8px;background:#fff;border-radius:16px;border:1px solid rgba(16,24,40,.07);box-shadow:0 24px 48px -16px rgba(16,24,40,.28);animation:zoomIn .12s ease both`)} onMouseEnter={v.sbKeep} onMouseLeave={v.sbLeave}>
        <span style={css("position:absolute;left:-6px;top:20px;width:12px;height:12px;background:#fff;border-left:1px solid rgba(16,24,40,.07);border-bottom:1px solid rgba(16,24,40,.07);transform:rotate(45deg)")} />
        <p style={css("position:relative;padding:6px 10px 8px;font:600 10.5px 'Geist';letter-spacing:.12em;text-transform:uppercase;color:#98A2B3")}>
          {v.hov?.title}
        </p>
        {(v.hov?.items||[]).map((hi,i4)=>(<React.Fragment key={i4}>
          <Hx as="div" s={`position:relative;display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border-radius:10px;background:${hi?.bg??""};color:${hi?.fg??""};font:550 13px 'Geist';cursor:pointer;white-space:nowrap`} h={"background:#F4F6F8"} onClick={hi?.go}>
            <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${hi?.ic??""}) center/contain no-repeat;mask:url(${hi?.ic??""}) center/contain no-repeat;color:#667085`)} />
            <span style={css("flex:1")}>
              {hi?.n}
            </span>
            {hi?.hasB ? (<>
              <span style={css("min-width:20px;height:18px;padding:0 6px;border-radius:6px;background:#F2F4F7;color:#344054;display:grid;place-items:center;font:600 10.5px 'Geist Mono'")}>
                {hi?.b}
              </span>
            </>) : null}
          </Hx>
        </React.Fragment>))}
      </div>
    </>
  );
}
