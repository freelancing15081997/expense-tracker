import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';

export default function Dropdown({ v }) {
  return (
    <>
      <div style={css("position:absolute;inset:0;z-index:80")}>
        <div style={css("position:absolute;inset:0")} onClick={v.pop?.close} />
        <div style={css(`position:absolute;left:${v.pop?.x??""};top:${v.pop?.top??""};bottom:${v.pop?.bot??""};width:${v.pop?.w??""};max-width:calc(100% - 16px);background:#fff;border-radius:16px;box-shadow:0 24px 48px -16px rgba(16,24,40,.3),0 0 0 1px rgba(16,24,40,.07);overflow:hidden;animation:zoomIn .14s ease both`)}>
          {v.pop?.hasSearch ? (<>
            <div style={css("display:flex;align-items:center;gap:8px;height:46px;padding:0 14px;border-bottom:1px solid #F0F2F5;color:#98A2B3")}>
              <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;")} />
              <input style={css("flex:1;min-width:0;border:0;padding:0;background:transparent;font:500 13.5px 'Geist';color:#0A1020;box-shadow:none !important")} autoFocus="autofocus" value={v.pop?.q} onChange={v.pop?.onQ} placeholder="Search…" />
            </div>
          </>) : null}
          {' '}
          {v.pop?.hasT ? (<>
            <p style={css("padding:10px 14px 2px;font:600 10.5px 'Geist';letter-spacing:.1em;color:#98A2B3;text-transform:uppercase")}>
              {v.pop?.title}
            </p>
          </>) : null}
          {' '}
          <div style={css(`max-height:${v.pop?.maxH??""};overflow-y:auto;padding:6px`)}>
            {(v.pop?.items||[]).map((po,i6)=>(<React.Fragment key={i6}>
              <div>
                {po?.isG ? (<>
                  <p style={css("padding:10px 10px 4px;font:600 10.5px 'Geist';letter-spacing:.1em;color:#98A2B3;text-transform:uppercase")}>
                    {po?.g}
                  </p>
                </>) : null}
                {po?.isO ? (<>
                  <Hx as="div" s={`display:flex;align-items:center;gap:10px;min-height:40px;padding:6px 10px;border-radius:10px;background:${po?.bg??""};cursor:pointer`} h={"background:#F5F7F9"} onClick={po?.go}>
                    {po?.hasIc ? (<>
                      <span style={css(`flex:none;width:28px;height:28px;border-radius:8px;background:${po?.icBg??""};color:${po?.icFg??""};display:grid;place-items:center`)}>
                        <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${po?.ic??""}) center/contain no-repeat;mask:url(${po?.ic??""}) center/contain no-repeat;`)} />
                      </span>
                    </>) : null}
                    <div style={css("flex:1;min-width:0")}>
                      <p style={css(`font:${po?.fw??""} 13.5px 'Geist';white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                        {po?.n}
                      </p>
                      {po?.hasS ? (<>
                        <p style={css("font:400 11.5px 'Geist';color:#98A2B3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                          {po?.s}
                        </p>
                      </>) : null}
                    </div>
                    {po?.on ? (<>
                      <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;color:#12B8A8")} />
                    </>) : null}
                  </Hx>
                </>) : null}
              </div>
            </React.Fragment>))}
            {' '}
            {v.pop?.none ? (<>
              <p style={css("padding:20px;text-align:center;font:500 13px 'Geist';color:#98A2B3")}>
                No matches
              </p>
            </>) : null}
          </div>
          {' '}
          <div style={css("padding:8px 14px;border-top:1px solid #F0F2F5;background:#FCFDFD;font:500 11px 'Geist Mono';color:#98A2B3")}>
            {v.pop?.cnt}
          </div>
        </div>
      </div>
    </>
  );
}
