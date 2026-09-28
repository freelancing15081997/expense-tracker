import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';

export default function Topbar({ v }) {
  return (
    <header style={css("position:relative;flex:none;height:68px;display:flex;align-items:center;gap:12px;padding:0 28px;z-index:20")}>
        {v.busy ? (<>
          <span style={css("position:absolute;left:28px;right:28px;bottom:0;height:2px;border-radius:2px;overflow:hidden")}>
            <span style={css("position:absolute;top:0;bottom:0;width:30%;background:linear-gradient(90deg,rgba(45,212,191,0),#2DD4BF,rgba(99,102,241,.8),rgba(99,102,241,0));animation:busy .9s ease-in-out infinite")} />
          </span>
        </>) : null}
        {' '}
        <div style={css("flex:0 1 auto;min-width:0;overflow:hidden;display:flex;align-items:center;gap:6px;font:500 13px 'Geist';color:#667085")}>
          <span style={css("display:grid;color:#98A2B3")}>
            <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/buildings-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/buildings-duotone.svg) center/contain no-repeat;")} />
          </span>
          <span style={css("white-space:nowrap")}>
            {v.crumbBlk}
          </span>
          <span style={css("color:#D0D5DD")}>
            /
          </span>
          <span style={css("font-weight:600;color:#0A1020;white-space:nowrap")}>
            {v.modN}
          </span>
        </div>
        {' '}
        <div style={css("flex:1;min-width:0;overflow:hidden;max-width:460px;margin-left:auto;display:flex;align-items:center;gap:10px;height:40px;padding:0 8px 0 14px;border-radius:12px;background:#fff;border:1px solid #E9EBEF;box-shadow:0 1px 2px rgba(10,16,32,.04);cursor:text;color:#98A2B3")} onClick={v.openCmd}>
          <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;")} />
          <span style={css("flex:1;min-width:0;font:400 13.5px 'Geist';white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
            Search or run a command…
          </span>
          <span style={css("flex:none;height:24px;padding:0 7px;border-radius:7px;background:#F2F4F7;display:grid;place-items:center;font:500 11px 'Geist Mono';color:#475467")}>
            ⌘K
          </span>
        </div>
        {' '}
        <div style={css("position:relative;flex:none")}>
          <Hx as="span" s={"height:40px;padding:0 14px 0 12px;border-radius:12px;background:linear-gradient(180deg,#22C7B5,#0FA898);color:#fff;display:inline-flex;align-items:center;gap:7px;font:600 13.5px 'Geist';cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 8px 18px -8px rgba(15,168,152,.9)"} h={"filter:brightness(1.05)"} onClick={v.toggleNew}>
            <span style={css("width:20px;height:20px;border-radius:6px;background:rgba(255,255,255,.25);color:#fff;display:grid;place-items:center")}>
              <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/plus.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/plus.svg) center/contain no-repeat;")} />
            </span>
            New
          </Hx>
          {' '}
          {v.newOpen ? (<>
            <div style={css("position:absolute;right:0;top:50px;width:600px;padding:10px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);border-radius:20px;box-shadow:0 30px 60px -24px rgba(10,16,32,.35);display:grid;grid-template-columns:repeat(3,1fr);gap:6px;animation:zoomIn .16s ease both;z-index:30")}>
              {(v.newGroups||[]).map((ng,i7)=>(<React.Fragment key={i7}>
                <div style={css("padding:6px;border-radius:14px;background:#FAFBFC")}>
                  <p style={css("padding:6px 8px 8px;font:600 10.5px 'Geist';letter-spacing:.12em;color:#98A2B3")}>
                    {ng?.g}
                  </p>
                  {(ng?.items||[]).map((ni,i9)=>(<React.Fragment key={i9}>
                    <Hx as="div" s={"display:flex;align-items:center;gap:10px;height:38px;padding:0 8px;border-radius:10px;font:500 13px 'Geist';cursor:pointer;color:#0A1020;transition:background .12s"} h={"background:#fff;box-shadow:0 1px 3px rgba(10,16,32,.08)"} onClick={ni?.go}>
                      <span style={css("width:26px;height:26px;border-radius:8px;background:#E6FAF6;color:#0B7A6F;display:grid;place-items:center")}>
                        <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${ni?.ic??""}) center/contain no-repeat;mask:url(${ni?.ic??""}) center/contain no-repeat;`)} />
                      </span>
                      {ni?.n}
                    </Hx>
                  </React.Fragment>))}
                </div>
              </React.Fragment>))}
            </div>
          </>) : null}
        </div>
        {' '}
        <div style={css("position:relative;flex:none")}>
          <span style={css("position:relative;width:40px;height:40px;border-radius:12px;background:#fff;border:1px solid #E9EBEF;box-shadow:0 1px 2px rgba(10,16,32,.04);display:grid;place-items:center;cursor:pointer;color:#344054")} onClick={v.toggleBell}>
            <span style={css("flex:none;width:17px;height:17px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/bell-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/bell-duotone.svg) center/contain no-repeat;")} />
            <span style={css("position:absolute;top:8px;right:9px;width:8px;height:8px;border-radius:50%;background:#F04438;box-shadow:0 0 0 2px #fff")} />
          </span>
          {' '}
          {v.bell ? (<>
            <div style={css("position:absolute;right:0;top:50px;width:380px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);border-radius:20px;box-shadow:0 30px 60px -24px rgba(10,16,32,.35);overflow:hidden;animation:zoomIn .16s ease both;z-index:30")}>
              <div style={css("display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #F2F4F7")}>
                <p style={css("font:600 14.5px 'Geist'")}>
                  Notifications
                </p>
                <span style={css("height:22px;padding:0 8px;border-radius:7px;background:#FEF3F2;color:#B42318;display:grid;place-items:center;font:600 11px 'Geist Mono'")}>
                  {v.bellN}{" new"}
                </span>
              </div>
              {(v.notes||[]).map((nt,i7)=>(<React.Fragment key={i7}>
                <Hx as="div" s={"display:flex;gap:12px;padding:12px 16px;cursor:pointer"} h={"background:#FAFBFC"} onClick={nt?.go}>
                  <span style={css("flex:none;width:34px;height:34px;border-radius:11px;background:#E6FAF6;color:#0B7A6F;display:grid;place-items:center")}>
                    <span style={css(`flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(${nt?.ic??""}) center/contain no-repeat;mask:url(${nt?.ic??""}) center/contain no-repeat;`)} />
                  </span>
                  <div style={css("flex:1;min-width:0")}>
                    <p style={css("font:500 13px/1.45 'Geist'")}>
                      {nt?.t}
                    </p>
                    <p style={css("margin-top:2px;font:400 11.5px 'Geist';color:#98A2B3")}>
                      {nt?.w}
                    </p>
                  </div>
                </Hx>
              </React.Fragment>))}
            </div>
          </>) : null}
        </div>
      </header>
  );
}
