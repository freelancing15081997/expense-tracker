import React from 'react';
import { css } from '../ui/css.js';

export default function ViewAsBanner({ v }) {
  return (
    <>
      <div style={css("flex:none;margin:12px 28px 0;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;border-radius:14px;background:linear-gradient(90deg,#FFFAEB,#FEF0C7);border:1px solid #FEDF89;color:#7A2E0E;box-shadow:0 8px 20px -16px rgba(181,71,8,.8)")}>
        <span style={css("flex:none;width:18px;height:18px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/eye-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/eye-duotone.svg) center/contain no-repeat;")} />
        <p style={css("flex:1;font:550 13.5px 'Geist'")}>
          {"Viewing as "}
          <b>
            {v.vaN}
          </b>
          {" · "}{v.vaR}. You see only what they can see. Read-only.
        </p>
        <span style={css("height:32px;padding:0 12px;border-radius:9px;background:#fff;border:1px solid #FEDF89;display:grid;place-items:center;font:600 12.5px 'Geist';cursor:pointer")} onClick={v.exitVa}>
          Exit view
        </span>
      </div>
    </>
  );
}
