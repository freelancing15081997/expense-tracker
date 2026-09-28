import React from 'react';
import { css } from '../../ui/css.js';
import Hx from '../../ui/Hx.jsx';

export default function PageHeader({ v }) {
  return (
    <div style={css("position:sticky;top:0;z-index:12;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:0 -8px;padding:14px 8px 14px;background:linear-gradient(180deg,rgba(245,246,248,.97) 82%,rgba(245,246,248,0));backdrop-filter:blur(6px)")}>
        <div style={css("min-width:0")}>
          {v.hello ? (<>
            <p style={css("display:flex;align-items:center;gap:8px;font:500 13px 'Geist';color:#667085")}>
              <span style={css("width:6px;height:6px;border-radius:50%;background:#12B76A")} />
              Thursday, 24 September · all systems synced
            </p>
          </>) : null}
          {v.pg?.hasGreet ? (<>
            <h1 style={css("margin-top:6px;font:650 32px/1.1 'Geist';letter-spacing:-.035em")}>
              {v.pg?.greet}
            </h1>
            <p style={css("margin-top:8px;font:500 14px 'Geist';color:#475467")}>
              {v.pg?.sum}
            </p>
          </>) : null}
          {v.pg?.noGreet ? (<>
            <h1 style={css("margin-top:6px;font:650 32px/1.1 'Geist';letter-spacing:-.035em")}>
              {v.modN}
            </h1>
            <p style={css("margin-top:8px;font:400 14.5px 'Geist';color:#667085")}>
              {v.blurb}
            </p>
          </>) : null}
        </div>
        {' '}
        <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
          {v.showPer ? (<>
            <div style={css("display:flex;padding:3px;border-radius:12px;background:#EEF0F3")}>
              {(v.per||[]).map((p,i7)=>(<React.Fragment key={i7}>
                <span style={css(`height:32px;padding:0 12px;border-radius:9px;background:${p?.bg??""};color:${p?.fg??""};box-shadow:${p?.sh??""};display:grid;place-items:center;font:550 12.5px 'Geist';cursor:pointer;transition:all .15s`)} onClick={p?.go}>
                  {p?.n}
                </span>
              </React.Fragment>))}
            </div>
          </>) : null}
          {(v.pg?.acts||[]).map((a,i5)=>(<React.Fragment key={i5}>
            <Hx as="span" s={`height:38px;padding:0 14px;border-radius:11px;background:${a?.bg??""};color:${a?.fg??""};border:1px solid ${a?.bd??""};box-shadow:0 1px 2px rgba(10,16,32,.06),inset 0 1px 0 rgba(255,255,255,.08);display:inline-flex;align-items:center;gap:7px;font:550 13.5px 'Geist';letter-spacing:-.005em;cursor:pointer;white-space:nowrap;transition:filter .15s,transform .1s`} h={"filter:brightness(.96)"} a={"transform:scale(.97)"} onClick={a?.go}>
              <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${a?.ic??""}) center/contain no-repeat;mask:url(${a?.ic??""}) center/contain no-repeat;`)} />
              {a?.n}
            </Hx>
          </React.Fragment>))}
        </div>
      </div>
  );
}
