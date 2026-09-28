import React from 'react';
import { css } from '../../ui/css.js';
import Hx from '../../ui/Hx.jsx';

export default function Roles({ v }) {
  return (
    <>
      <div style={css("margin-top:22px;display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px")}>
        {(v.rolesBar||[]).map((rl,i4)=>(<React.Fragment key={i4}>
          <Hx as="div" s={`padding:14px;border-radius:18px;background:linear-gradient(180deg,#fff,#FBFCFD);border:1.5px solid ${rl?.bd??""};box-shadow:${rl?.sh??""};cursor:pointer;transition:transform .15s,box-shadow .2s`} h={"transform:translateY(-2px)"} onClick={rl?.go}>
            <div style={css("display:flex;align-items:center;justify-content:space-between")}>
              <span style={css(`width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(160deg,#fff -40%,${rl?.bg??""} 100%);color:${rl?.c??""};box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 6px 12px -7px ${rl?.c??""}`)}>
                <span style={css(`flex:none;width:17px;height:17px;background:currentColor;-webkit-mask:url(${rl?.ic??""}) center/contain no-repeat;mask:url(${rl?.ic??""}) center/contain no-repeat;`)} />
              </span>
              <span style={css("font:500 11.5px 'Geist Mono';color:#98A2B3")}>
                {rl?.cnt}
              </span>
            </div>
            <p style={css("margin-top:12px;font:600 14.5px 'Geist';letter-spacing:-.01em")}>
              {rl?.n}
            </p>
            <p style={css("margin-top:3px;font:400 12px/1.4 'Geist';color:#667085")}>
              {rl?.d}
            </p>
          </Hx>
        </React.Fragment>))}
      </div>
    </>
  );
}
