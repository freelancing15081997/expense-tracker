import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';

export default function WorkspaceMenu({ v }) {
  return (
    <>
      <div style={css("position:absolute;inset:0;z-index:44")}>
        <div style={css("position:absolute;inset:0")} onClick={v.toggleWs} />
        <div style={css("position:absolute;left:14px;top:120px;width:300px;padding:8px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);box-shadow:0 24px 50px -20px rgba(11,31,58,.45);animation:zoomIn .15s ease both")}>
          <p style={css("padding:8px 10px 6px;font:650 11px 'Geist';letter-spacing:.08em;color:#98A2B3")}>
            WORKSPACE
          </p>
          {(v.wsList||[]).map((w,i5)=>(<React.Fragment key={i5}>
            <Hx as="div" s={`display:flex;align-items:center;gap:10px;padding:10px;border-radius:11px;background:${w?.bg??""};cursor:pointer`} h={"background:#F5F6F8"} onClick={w?.go}>
              <span style={css("width:34px;height:34px;border-radius:11px;background:linear-gradient(180deg,#22C7B5,#0FA898);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 8px 18px -10px rgba(15,168,152,.9);display:grid;place-items:center")}>
                <span style={css(`flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(${w?.ic??""}) center/contain no-repeat;mask:url(${w?.ic??""}) center/contain no-repeat;`)} />
              </span>
              <div style={css("flex:1;min-width:0")}>
                <p style={css("font:600 13.5px 'Geist'")}>
                  {w?.n}
                </p>
                <p style={css("font:500 11.5px 'Geist';color:#667085")}>
                  {w?.sub}
                </p>
              </div>
              {w?.on ? (<>
                <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;color:#12B8A8")} />
              </>) : null}
            </Hx>
          </React.Fragment>))}
        </div>
      </div>
    </>
  );
}
