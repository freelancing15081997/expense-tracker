import React from 'react';
import { css } from '../../ui/css.js';

export default function Note({ v }) {
  return (
    <>
      <div style={css("margin-top:20px;display:flex;gap:12px;padding:14px 16px;border-radius:16px;background:linear-gradient(90deg,#EEF4FF,#F5F8FF);box-shadow:inset 0 0 0 1px #DCE6FF;color:#1E3A8A;font:500 13.5px/1.55 'Geist'")}>
        <span style={css("flex:none;width:28px;height:28px;border-radius:9px;background:#fff;color:#4F46E5;display:grid;place-items:center")}>
          <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/info-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/info-duotone.svg) center/contain no-repeat;")} />
        </span>
        <span>
          {v.pg?.note}
        </span>
      </div>
    </>
  );
}
