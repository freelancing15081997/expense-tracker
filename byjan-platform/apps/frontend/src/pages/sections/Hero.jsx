import React from 'react';
import { css } from '../../ui/css.js';
import Hx from '../../ui/Hx.jsx';

export default function Hero({ v }) {
  return (
    <>
      <div style={css("margin-top:22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px")}>
        <div style={css("position:relative;min-height:280px;padding:24px;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 16px 36px -24px rgba(16,24,40,.25);animation:rise .4s ease both")}>
          <span style={css("position:absolute;left:-80px;bottom:-140px;width:340px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(45,212,191,.10),transparent 65%)")} />
          {' '}
          <div style={css("position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px")}>
            <p style={css("display:flex;align-items:center;gap:8px;font:500 13px 'Geist';color:#475467")}>
              <span style={css("width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(160deg,#fff -40%,#CCFBF1 100%);color:#0B7A6F;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 0 rgba(16,24,40,.05),0 4px 10px -4px #0B7A6F55")}>
                <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/bank-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/bank-duotone.svg) center/contain no-repeat;")} />
              </span>
              {v.hero?.lbl}
            </p>
            <span style={css("height:26px;padding:0 10px;border-radius:8px;background:#DCFAE6;color:#067647;display:flex;align-items:center;gap:5px;font:600 11.5px 'Geist Mono';box-shadow:inset 0 0 0 1px rgba(6,118,71,.12)")}>
              <span style={css("flex:none;width:13px;height:13px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/trend-up-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/trend-up-duotone.svg) center/contain no-repeat;")} />
              {v.hero?.chip}
            </span>
          </div>
          {' '}
          <p style={css("position:relative;margin-top:14px;font:600 46px/1 'Geist Mono';letter-spacing:-.05em;color:#0B1F3A")}>
            {v.hero?.bal}
          </p>
          {' '}
          <svg style={css("position:relative;display:block;width:100%;height:96px;margin-top:14px")} viewBox="0 0 600 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#12B8A8" stopOpacity=".28" />
                <stop offset="1" stopColor="#12B8A8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={v.hero?.a} fill="url(#hg)" />
            <path style={css("stroke-dasharray:1;animation:draw 1.4s cubic-bezier(.2,.8,.2,1) both")} d={v.hero?.d} fill="none" stroke="#12B8A8" strokeWidth="2.4" vectorEffect="non-scaling-stroke" pathLength="1" />
          </svg>
          {' '}
          <div style={css("position:relative;margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px")}>
            {(v.hero?.accts||[]).map((h,i6)=>(<React.Fragment key={i6}>
              <div style={css("padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.75);backdrop-filter:blur(8px);border:1px solid rgba(16,24,40,.06);box-shadow:inset 0 1px 0 #fff,0 6px 14px -10px rgba(16,24,40,.25)")}>
                <p style={css("font:500 11.5px 'Geist';color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                  {h?.n}{" · "}{h?.no}
                </p>
                <p style={css("margin-top:3px;font:600 15px 'Geist Mono';letter-spacing:-.03em;color:#0B1F3A")}>
                  {h?.b}
                </p>
              </div>
            </React.Fragment>))}
          </div>
        </div>
        {' '}
        <div style={css("display:flex;flex-direction:column;padding:18px 18px 10px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);border-radius:24px;animation:rise .4s .05s ease both")}>
          <div style={css("display:flex;align-items:center;gap:8px;padding:0 4px 10px")}>
            <p style={css("font:600 15px 'Geist';letter-spacing:-.015em")}>
              Today
            </p>
            <span style={css("height:20px;min-width:20px;padding:0 6px;border-radius:6px;background:#F2F4F7;color:#344054;display:grid;place-items:center;font:600 11px 'Geist Mono'")}>
              {v.pg?.todayN}
            </span>
            <span style={css("margin-left:auto;font:500 12px 'Geist';color:#98A2B3")}>
              Most urgent first
            </span>
          </div>
          {(v.pg?.today||[]).map((td,i5)=>(<React.Fragment key={i5}>
            <Hx as="div" s={"display:flex;align-items:center;gap:12px;min-height:50px;padding:6px 8px;border-radius:12px;border-top:1px solid #F4F5F7;cursor:pointer;transition:background .12s"} h={"background:#F8FAFB"} onClick={td?.go}>
              <span style={css("flex:none;width:32px;height:32px;border-radius:10px;background:#F4F6F8;color:#475467;display:grid;place-items:center")}>
                <span style={css(`flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(${td?.ic??""}) center/contain no-repeat;mask:url(${td?.ic??""}) center/contain no-repeat;`)} />
              </span>
              <div style={css("flex:1;min-width:0")}>
                <p style={css("display:flex;align-items:center;gap:6px;font:550 13.5px 'Geist'")}>
                  {td?.t}
                  <span style={css(`width:6px;height:6px;border-radius:50%;background:#F04438;display:${td?.ring??""}`)} />
                </p>
                <p style={css("font:400 12px 'Geist';color:#98A2B3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                  {td?.s}
                </p>
              </div>
              <span style={css("flex:none;font:600 14px 'Geist Mono';letter-spacing:-.02em;color:#0A1020")}>
                {td?.v}
              </span>
              <Hx as="span" s={"flex:none;height:28px;padding:0 10px;border-radius:8px;border:1px solid #E4E7EC;background:#fff;display:flex;align-items:center;gap:4px;font:550 12px 'Geist';color:#344054;white-space:nowrap"} h={"border-color:#99E6DA;color:#0B6B61"}>
                {td?.cta}
                <span style={css("flex:none;width:12px;height:12px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-right.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-right.svg) center/contain no-repeat;")} />
              </Hx>
            </Hx>
          </React.Fragment>))}
        </div>
      </div>
      {' '}
      <div style={css("margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
        <span style={css("font:550 12.5px 'Geist';color:#98A2B3;margin-right:4px")}>
          Quick actions
        </span>
        {(v.hero?.quick||[]).map((qa,i4)=>(<React.Fragment key={i4}>
          <Hx as="span" s={"height:36px;padding:0 12px 0 10px;border-radius:11px;background:#fff;border:1px solid #E9EBEF;box-shadow:0 1px 2px rgba(16,24,40,.04);display:flex;align-items:center;gap:8px;font:550 13px 'Geist';color:#344054;cursor:pointer;transition:border-color .15s,transform .12s"} h={"border-color:#99E6DA;transform:translateY(-1px)"} onClick={qa?.go}>
            <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${qa?.ic??""}) center/contain no-repeat;mask:url(${qa?.ic??""}) center/contain no-repeat;color:#0FA898`)} />
            {qa?.n}
          </Hx>
        </React.Fragment>))}
        <span style={css("margin-left:auto;display:flex;align-items:center;gap:6px;font:500 12px 'Geist';color:#98A2B3")}>
          {"Press "}
          <span style={css("height:20px;min-width:20px;padding:0 5px;border-radius:6px;background:#F2F4F7;display:grid;place-items:center;font:600 11px 'Geist Mono';color:#344054")}>
            N
          </span>
          {" for new"}
        </span>
      </div>
    </>
  );
}
