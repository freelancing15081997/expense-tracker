import React from 'react';
import { css } from '../../ui/css.js';
import Hx from '../../ui/Hx.jsx';

export default function Kpis({ v }) {
  return (
    <>
      <div style={css("margin-top:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px")}>
        {(v.pg?.kpis||[]).map((k,i4)=>(<React.Fragment key={i4}>
          <Hx as="div" s={`position:relative;overflow:hidden;padding:18px 18px 16px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);border-color:${k?.bdc??""};cursor:${k?.cur??""};transition:box-shadow .2s,transform .2s;animation:rise .4s ease both`} h={"transform:translateY(-2px);box-shadow:0 16px 32px -22px rgba(10,16,32,.35)"} onClick={k?.go}>
            {v.busy ? (<>
              <div style={css("position:absolute;inset:0;z-index:4;border-radius:20px;background:#fff;padding:18px;display:flex;flex-direction:column;gap:12px;animation:fade .15s ease both")}>
                <span style={css("height:12px;width:40%;border-radius:99px;background:linear-gradient(90deg,#F2F4F7 25%,#FAFBFC 50%,#F2F4F7 75%);background-size:800px 100%;animation:shimmer 1.2s linear infinite")} />
                <span style={css("height:22px;width:62%;border-radius:8px;background:linear-gradient(90deg,#F2F4F7 25%,#FAFBFC 50%,#F2F4F7 75%);background-size:800px 100%;animation:shimmer 1.2s linear infinite")} />
                <span style={css("height:10px;width:80%;border-radius:99px;background:linear-gradient(90deg,#F2F4F7 25%,#FAFBFC 50%,#F2F4F7 75%);background-size:800px 100%;animation:shimmer 1.2s linear infinite")} />
              </div>
            </>) : null}
            <div style={css("display:flex;align-items:center;gap:8px")}>
              <span style={css(`width:30px;height:30px;border-radius:10px;background:linear-gradient(160deg,#fff -40%,${k?.icBg??""} 100%);color:${k?.icFg??""};box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 0 rgba(16,24,40,.05),0 6px 12px -8px ${k?.icFg??""};display:grid;place-items:center`)}>
                <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${k?.ic??""}) center/contain no-repeat;mask:url(${k?.ic??""}) center/contain no-repeat;`)} />
              </span>
              <p style={css("font:500 13px 'Geist';color:#475467;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                {k?.l}
              </p>
            </div>
            <div style={css("margin-top:14px;display:flex;align-items:flex-end;justify-content:space-between;gap:10px")}>
              <div style={css("min-width:0")}>
                <p style={css("font:600 26px/1.05 'Geist Mono';letter-spacing:-.045em;white-space:nowrap")}>
                  {k?.v}
                </p>
                <p style={css(`margin-top:8px;font:500 12px 'Geist';color:${k?.sFg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                  {k?.s}
                </p>
              </div>
              <svg style={css("flex:none;width:96px;height:36px")} viewBox="0 0 120 36" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={k?.gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={k?.sc} stopOpacity=".28" />
                    <stop offset="1" stopColor={k?.sc} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={k?.sa} fill={`url(#${k?.gid??""})`} />
                <path d={k?.sd} fill="none" stroke={k?.sc} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              </svg>
            </div>
          </Hx>
        </React.Fragment>))}
      </div>
    </>
  );
}
