import React from 'react';
import { css } from '../ui/css.js';

export default function CaBanner({ v }) {
  return (
    <>
      <div style={css("flex:none;margin:12px 28px 0;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 14px;border-radius:14px;background:linear-gradient(90deg,#EEF4FF,#F0FDFA);border:1px solid #C7D7FE;color:#1E3A8A;box-shadow:0 8px 20px -16px rgba(79,70,229,.7)")}>
        <span style={css("width:30px;height:30px;border-radius:9px;background:#fff;color:#4F46E5;display:grid;place-items:center;box-shadow:0 0 0 1px #E0E7FF")}>
          <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/briefcase-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/briefcase-duotone.svg) center/contain no-repeat;")} />
        </span>
        <p style={css("flex:1;min-width:0;font:550 13.5px 'Geist';white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
          {"You’re in "}
          <b>
            {v.caClN}
          </b>
          ’s books as their CA · every change is logged for the client
        </p>
        <span style={css("height:32px;padding:0 12px;border-radius:9px;background:#fff;border:1px solid #C7D7FE;display:flex;align-items:center;gap:6px;font:600 12.5px 'Geist';color:#3730A3;cursor:pointer;white-space:nowrap;flex:none")} onClick={v.backPractice}>
          <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/lucide-static@0.460.0/icons/arrow-u-up-left.svg) center/contain no-repeat;mask:url(https://unpkg.com/lucide-static@0.460.0/icons/arrow-u-up-left.svg) center/contain no-repeat;")} />
          Back to practice
        </span>
      </div>
    </>
  );
}
