import React from 'react';
import { css } from '../ui/css.js';

export default function BootLoader({ v }) {
  return (
    <>
      <div style={css("position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(70% 60% at 30% 20%,rgba(45,212,191,.22),transparent 60%),radial-gradient(60% 60% at 80% 80%,rgba(99,102,241,.14),transparent 60%),#F7FAFA;color:#0B1F3A;animation:fade .3s ease both")}>
        <span style={css("position:absolute;left:50%;top:40%;width:520px;height:520px;margin:-260px 0 0 -260px;border-radius:50%;background:radial-gradient(circle,rgba(18,184,168,.25),rgba(18,184,168,0) 62%);animation:bjPulse 2.4s ease-in-out infinite")} />
        {' '}
        <div style={css("position:relative;width:128px;height:128px;border-radius:34px;background:linear-gradient(145deg,#FFFFFF,#E6F6F4);display:grid;place-items:center;box-shadow:inset 0 1px 0 #fff,0 0 0 1px rgba(16,24,40,.06),0 30px 60px -24px rgba(18,120,110,.55);animation:bjPop .7s cubic-bezier(.2,.9,.3,1.2) both")}>
          <svg viewBox="0 0 58 51" width="92" height="81" fill="none">
            <rect style={css("animation:bjRise .4s .3s ease both")} x="0.5" y="42" width="6.5" height="7.5" rx="1.6" fill="#0A1020" />
            {' '}
            <rect style={css("animation:bjRise .4s .4s ease both")} x="8.5" y="42" width="6.5" height="7.5" rx="1.6" fill="#0A1020" />
            {' '}
            <rect style={css("transform-box:fill-box;transform-origin:50% 100%;animation:bjGrow .5s .5s cubic-bezier(.2,.8,.2,1) both")} x="16.5" y="2" width="10" height="47.5" rx="2.4" fill="#0A1020" />
            {' '}
            <path style={css("animation:bjRise .45s .75s ease both")} fill="#0A1020" fillRule="evenodd" d="M25 18.5H31.5A15.5 15.5 0 0 1 31.5 49.5H25ZM25 27.5H31.5A6.5 6.5 0 0 1 31.5 40.5H25Z" />
            {' '}
            <path style={css("stroke-dasharray:100;animation:bjDraw .7s .95s ease-out both")} d="M19 42C33.5 41.5 43 34 48.5 17" stroke="#F2FAF9" strokeWidth="11.5" strokeLinecap="round" pathLength="100" />
            {' '}
            <path style={css("stroke-dasharray:100;animation:bjDraw .7s .95s ease-out both")} d="M19 42C33.5 41.5 43 34 48.5 17" stroke="#12B8A8" strokeWidth="6.8" strokeLinecap="round" pathLength="100" />
            {' '}
            <path style={css("transform-box:fill-box;transform-origin:30% 70%;animation:bjPop .45s 1.55s cubic-bezier(.2,.9,.3,1.4) both")} d="M40.6 19.6L57 17.4L50.6 2.4Z" fill="#12B8A8" stroke="#F2FAF9" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
        {' '}
        <p style={css("position:relative;margin-top:24px;font:650 40px/1 'Geist';letter-spacing:-.045em;animation:rise .6s .3s ease both")}>
          byjan
        </p>
        {' '}
        <p style={css("position:relative;margin-top:10px;font:600 12px 'Geist';letter-spacing:.2em;color:#0FA898;animation:rise .6s .45s ease both")}>
          BUSINESS
        </p>
        {' '}
        <div style={css("position:relative;margin-top:40px;width:300px;animation:fade .5s .5s ease both")}>
          <div style={css("height:4px;border-radius:99px;background:#E4E7EC;overflow:hidden")}>
            <span style={css(`display:block;height:100%;width:${v.boot?.pct??""};border-radius:99px;background:linear-gradient(90deg,#2DD4BF,#6366F1);transition:width .5s ease`)} />
          </div>
          {' '}
          <div style={css("margin-top:16px;display:flex;flex-direction:column;gap:8px")}>
            {(v.boot?.steps||[]).map((st,i6)=>(<React.Fragment key={i6}>
              <div style={css(`display:flex;align-items:center;gap:10px;opacity:${st?.op??""};transition:opacity .3s`)}>
                <span style={css(`width:8px;height:8px;border-radius:50%;background:${st?.dot??""};transition:background .3s`)} />
                <span style={css("font:500 13px 'Geist';color:#475467")}>
                  {st?.t}
                </span>
              </div>
            </React.Fragment>))}
          </div>
        </div>
      </div>
    </>
  );
}
