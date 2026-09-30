import React from 'react';
import ByjanLoader from '../brand/ByjanLoader.jsx';
import { css } from '../ui/css.js';

export default function BootLoader({ v }) {
  return (
    <>
      <div style={css("position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(70% 60% at 30% 20%,rgba(45,212,191,.22),transparent 60%),radial-gradient(60% 60% at 80% 80%,rgba(99,102,241,.14),transparent 60%),#F7FAFA;color:#0B1F3A;animation:fade .3s ease both")}>
        <span style={css("position:absolute;left:50%;top:40%;width:520px;height:520px;margin:-260px 0 0 -260px;border-radius:50%;background:radial-gradient(circle,rgba(23,177,140,.22),rgba(23,177,140,0) 62%);animation:bjPulse 2.4s ease-in-out infinite")} />
        {' '}
        <div style={css("position:relative;width:128px;height:128px;border-radius:34px;background:#fff;display:grid;place-items:center;box-shadow:0 0 0 1px rgba(15,28,54,.06),0 30px 60px -24px rgba(15,28,54,.35);animation:bjPop .7s cubic-bezier(.2,.9,.3,1.2) both")}>
          <ByjanLoader size={104} />
        </div>
        {' '}
        <p style={css("position:relative;margin-top:24px;font:600 42px/1 'Poppins';letter-spacing:-.03em;color:#0f1c36;animation:rise .6s .3s ease both")}>
          byjan
        </p>
        {' '}
        <p style={css("position:relative;margin-top:10px;font:600 12px 'Geist';letter-spacing:.2em;color:#17b18c;animation:rise .6s .45s ease both")}>
          BUSINESS
        </p>
        {' '}
        <div style={css("position:relative;margin-top:40px;width:300px;animation:fade .5s .5s ease both")}>
          <div style={css("height:4px;border-radius:99px;background:#E4E7EC;overflow:hidden")}>
            <span style={css(`display:block;height:100%;width:${v.boot?.pct??""};border-radius:99px;background:linear-gradient(90deg,#0f1c36,#17b18c);transition:width .5s ease`)} />
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
