import React from 'react';
import { css } from '../../ui/css.js';

export default function Views({ v }) {
  return (
    <>
      <div style={css("margin-top:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
        <div style={css("display:flex;padding:3px;border-radius:12px;background:#EEF0F3")}>
          {(v.pg?.views||[]).map((vw,i5)=>(<React.Fragment key={i5}>
            <span style={css(`height:34px;padding:0 14px;border-radius:9px;background:${vw?.bg??""};color:${vw?.fg??""};box-shadow:${vw?.sh??""};display:flex;align-items:center;gap:7px;font:550 13px 'Geist';cursor:pointer`)} onClick={vw?.go}>
              <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${vw?.ic??""}) center/contain no-repeat;mask:url(${vw?.ic??""}) center/contain no-repeat;`)} />
              {vw?.n}
            </span>
          </React.Fragment>))}
        </div>
        {v.pg?.searchTop ? (<>
          <div style={css("flex:0 1 340px;min-width:200px;display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border-radius:12px;border:1px solid #E9EBEF;background:#fff;color:#98A2B3;box-shadow:0 1px 2px rgba(16,24,40,.04)")}>
            <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;")} />
            <input style={css("flex:1;min-width:0;border:0;padding:0;background:transparent;font:500 13px 'Geist';color:#0A1020;box-shadow:none !important")} value={v.pg?.q} onChange={v.pg?.onQ} placeholder={v.pg?.search} />
          </div>
        </>) : null}
      </div>
    </>
  );
}
