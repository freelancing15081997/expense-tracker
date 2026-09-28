import React from 'react';
import { css } from '../../ui/css.js';
import Hx from '../../ui/Hx.jsx';

export default function Picker({ v }) {
  return (
    <>
      <div style={css("margin-top:20px;display:flex;align-items:center;gap:10px")}>
        <span style={css("font:550 13px 'Geist';color:#475467")}>
          {v.pg?.picker?.l}
        </span>
        <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${v.pg?.picker?.dd?.bd??""};background:#fff;box-shadow:${v.pg?.picker?.dd?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;min-width:300px`} h={"border-color:#99E6DA"} onClick={v.pg?.picker?.dd?.open}>
          {v.pg?.picker?.dd?.hasIc ? (<>
            <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${v.pg?.picker?.dd?.icBg??""};color:${v.pg?.picker?.dd?.icFg??""};display:grid;place-items:center`)}>
              <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${v.pg?.picker?.dd?.ic??""}) center/contain no-repeat;mask:url(${v.pg?.picker?.dd?.ic??""}) center/contain no-repeat;`)} />
            </span>
          </>) : null}
          <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${v.pg?.picker?.dd?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
            {v.pg?.picker?.dd?.label}
          </span>
          <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
        </Hx>
      </div>
    </>
  );
}
