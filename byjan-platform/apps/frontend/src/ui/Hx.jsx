import React, { useState } from 'react';
import { css } from './css.js';

// Element with hover / pressed styles (the design's style-hover / style-active).
export default function Hx({ as: Tag = 'div', s, h, a, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp, ...rest }) {
  const [hov, setHov] = useState(false);
  const [act, setAct] = useState(false);
  const style = { ...css(s), ...(hov && h ? css(h) : null), ...(act && a ? css(a) : null) };
  return (
    <Tag
      {...rest}
      style={style}
      onMouseEnter={e => { setHov(true); onMouseEnter && onMouseEnter(e); }}
      onMouseLeave={e => { setHov(false); setAct(false); onMouseLeave && onMouseLeave(e); }}
      onMouseDown={e => { setAct(true); onMouseDown && onMouseDown(e); }}
      onMouseUp={e => { setAct(false); onMouseUp && onMouseUp(e); }}
    />
  );
}
