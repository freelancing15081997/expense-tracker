import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';

export default function CommandPalette({ v }) {
  return (
    <>
      <div style={css("position:absolute;inset:0;z-index:45;display:flex;justify-content:center;padding-top:90px")}>
        <div style={css("position:absolute;inset:0;background:rgba(10,16,32,.45);backdrop-filter:blur(3px);animation:fade .15s ease both")} onClick={v.closeCmd} />
        {' '}
        <div style={css("position:relative;width:640px;max-width:calc(100% - 32px);max-height:520px;display:flex;flex-direction:column;background:#fff;border-radius:24px;box-shadow:0 40px 80px -30px rgba(10,16,32,.6),0 0 0 1px rgba(10,16,32,.06);overflow:hidden;animation:zoomIn .15s ease both")}>
          <div style={css("flex:none;display:flex;align-items:center;gap:12px;height:60px;padding:0 18px;border-bottom:1px solid #EEF1F5;color:#667085")}>
            <span style={css("flex:none;width:19px;height:19px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;")} />
            <input style={css("flex:1;min-width:0;border:0;padding:0;font:500 16px 'Geist';color:#0A1020;box-shadow:none")} autoFocus="autofocus" value={v.cq} onChange={v.onCq} placeholder="Search or type a command, e.g. “new invoice” or “Mehta”" />
            <span style={css("height:24px;padding:0 7px;border-radius:6px;border:1px solid #E4E7EC;display:grid;place-items:center;font:600 11px 'Geist'")}>
              Esc
            </span>
          </div>
          {' '}
          <div style={css("flex:1;min-height:0;overflow-y:auto;padding:8px")}>
            {(v.cmdRes||[]).map((r,i6)=>(<React.Fragment key={i6}>
              <div>
                {r?.showG ? (<>
                  <p style={css("padding:10px 10px 4px;font:650 11px 'Geist';letter-spacing:.08em;color:#98A2B3")}>
                    {r?.g}
                  </p>
                </>) : null}
                <Hx as="div" s={`display:flex;align-items:center;gap:12px;height:46px;padding:0 10px;border-radius:11px;background:${r?.bg??""};cursor:pointer`} h={"background:#F0FAF8"} onClick={r?.go}>
                  <span style={css("width:30px;height:30px;border-radius:9px;background:#F5F6F8;color:#0A1020;display:grid;place-items:center")}>
                    <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${r?.ic??""}) center/contain no-repeat;mask:url(${r?.ic??""}) center/contain no-repeat;`)} />
                  </span>
                  <span style={css("flex:1;min-width:0;font:600 13.5px 'Geist';white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                    {r?.t}
                  </span>
                  <span style={css("font:500 12px 'Geist';color:#98A2B3")}>
                    {r?.s}
                  </span>
                </Hx>
              </div>
            </React.Fragment>))}
            {' '}
            {v.cmdNone ? (<>
              <p style={css("padding:28px;text-align:center;font:500 13.5px 'Geist';color:#98A2B3")}>
                Nothing found for “{v.cq}”
              </p>
            </>) : null}
          </div>
          {' '}
          <div style={css("flex:none;display:flex;gap:16px;padding:10px 18px;border-top:1px solid #EEF1F5;background:#F8FAFB;font:500 11.5px 'Geist';color:#98A2B3")}>
            <span>
              Enter to open
            </span>
            <span>
              Esc to close
            </span>
            <span style={css("margin-left:auto")}>
              Byjan Business
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
