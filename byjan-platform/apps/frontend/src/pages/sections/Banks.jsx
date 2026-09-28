import React from 'react';
import { css } from '../../ui/css.js';
import Hx from '../../ui/Hx.jsx';

export default function Banks({ v }) {
  return (
    <>
      <div style={css("margin-top:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px")}>
        {(v.pg?.banks||[]).map((bk,i4)=>(<React.Fragment key={i4}>
          <Hx as="div" s={`position:relative;overflow:hidden;padding:18px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);border-color:${bk?.bd??""};box-shadow:${bk?.sh??""};cursor:pointer;transition:transform .15s`} h={"transform:translateY(-2px)"} onClick={bk?.go}>
            <span style={css("position:absolute;right:-30px;top:-30px;width:110px;height:110px;border-radius:50%;background:radial-gradient(circle,rgba(45,212,191,.16),transparent 70%)")} />
            <div style={css("position:relative;display:flex;align-items:center;gap:10px")}>
              <span style={css("width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(160deg,#fff -40%,#CCFBF1 100%);color:#0B7A6F;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 0 rgba(16,24,40,.05),0 4px 10px -4px #0B7A6F55")}>
                <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/bank-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/bank-duotone.svg) center/contain no-repeat;")} />
              </span>
              <div style={css("min-width:0")}>
                <p style={css("font:600 13.5px 'Geist';white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                  {bk?.n}
                </p>
                <p style={css("font:500 11.5px 'Geist Mono';color:#98A2B3")}>
                  {bk?.no}
                </p>
              </div>
            </div>
            <p style={css(`position:relative;margin-top:16px;font:600 22px 'Geist Mono';letter-spacing:-.04em;color:${bk?.bFg??""}`)}>
              {bk?.b}
            </p>
            <p style={css("position:relative;margin-top:3px;display:flex;align-items:center;gap:6px;font:500 11.5px 'Geist';color:#98A2B3")}>
              <span style={css("width:6px;height:6px;border-radius:50%;background:#12B76A")} />
              {bk?.sy}
            </p>
          </Hx>
        </React.Fragment>))}
      </div>
    </>
  );
}
