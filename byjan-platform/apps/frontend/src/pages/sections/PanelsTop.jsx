import React from 'react';
import { css } from '../../ui/css.js';
import Panel from '../../pages/Panel.jsx';

export default function PanelsTop({ v }) {
  return (
    <>
      <div style={css("margin-top:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:16px")}>
        {(v.pg?.panels||[]).map((pn,i4)=>(<React.Fragment key={i4}>
          <Panel v={v} pn={pn} />
        </React.Fragment>))}
      </div>
    </>
  );
}
