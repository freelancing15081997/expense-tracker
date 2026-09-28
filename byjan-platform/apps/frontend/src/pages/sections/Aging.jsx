import React from 'react';
import { css } from '../../ui/css.js';

export default function Aging({ v }) {
  return (
    <>
      <div style={css("margin-top:14px;padding:20px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16)")}>
        <div style={css("display:flex;justify-content:space-between;align-items:baseline")}>
          <span style={css("font:600 15px 'Geist';letter-spacing:-.015em")}>
            {v.pg?.aging?.t}
          </span>
          <span style={css("font:600 18px 'Geist Mono';letter-spacing:-.03em")}>
            {v.pg?.aging?.tot}
          </span>
        </div>
        <div style={css("margin-top:14px;height:12px;border-radius:99px;overflow:hidden;display:flex;gap:3px")}>
          {(v.pg?.aging?.bars||[]).map((ab,i5)=>(<React.Fragment key={i5}>
            <span style={css(`height:100%;width:${ab?.w??""};border-radius:99px;background:${ab?.c??""};cursor:pointer;animation:grow .8s cubic-bezier(.2,.8,.2,1) both`)} onClick={ab?.go} />
          </React.Fragment>))}
        </div>
        <div style={css("margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px")}>
          {(v.pg?.aging?.bars||[]).map((ab,i5)=>(<React.Fragment key={i5}>
            <div style={css("padding:10px 12px;border-radius:12px;background:#FAFBFC;box-shadow:inset 0 0 0 1px #F0F2F5;cursor:pointer")} onClick={ab?.go}>
              <p style={css("display:flex;align-items:center;gap:7px;font:500 12px 'Geist';color:#667085")}>
                <span style={css(`width:8px;height:8px;border-radius:3px;background:${ab?.c??""}`)} />
                {ab?.l}
              </p>
              <p style={css("margin-top:4px;font:600 15px 'Geist Mono';letter-spacing:-.03em")}>
                {ab?.v}
              </p>
            </div>
          </React.Fragment>))}
        </div>
      </div>
    </>
  );
}
