import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';

export default function Panel({ v, pn }) {
  return (
    <section style={css(`position:relative;grid-column:${pn?.span??""};min-width:0;padding:20px 22px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);border-radius:22px;animation:rise .4s ease both`)}>
        {v.busy ? (<>
          <div style={css("position:absolute;inset:0;z-index:4;border-radius:22px;background:#fff;padding:18px;display:flex;flex-direction:column;gap:12px;animation:fade .15s ease both")}>
            <span style={css("height:12px;width:40%;border-radius:99px;background:linear-gradient(90deg,#F2F4F7 25%,#FAFBFC 50%,#F2F4F7 75%);background-size:800px 100%;animation:shimmer 1.2s linear infinite")} />
            <span style={css("height:22px;width:62%;border-radius:8px;background:linear-gradient(90deg,#F2F4F7 25%,#FAFBFC 50%,#F2F4F7 75%);background-size:800px 100%;animation:shimmer 1.2s linear infinite")} />
            <span style={css("height:10px;width:80%;border-radius:99px;background:linear-gradient(90deg,#F2F4F7 25%,#FAFBFC 50%,#F2F4F7 75%);background-size:800px 100%;animation:shimmer 1.2s linear infinite")} />
          </div>
        </>) : null}
        {' '}
        <div style={css("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
          <div style={css("min-width:0")}>
            <h3 style={css("font:600 16px 'Geist';letter-spacing:-.02em")}>
              {pn?.t}
            </h3>
            {pn?.hasS ? (<>
              <p style={css("margin-top:4px;font:400 12.5px 'Geist';color:#667085")}>
                {pn?.s}
              </p>
            </>) : null}
          </div>
          <div style={css("display:flex;align-items:center;gap:10px")}>
            {pn?.isRep ? (<>
              {v.pg?.hasCmp ? (<>
                <div style={css("display:flex;align-items:center;gap:8px;font:500 12.5px 'Geist';color:#475467")}>
                  {v.pg?.cmp?.l}
                  <span style={css(`flex:none;width:38px;height:22px;border-radius:99px;background:${v.pg?.cmp?.bg??""};padding:2px;display:flex;justify-content:${v.pg?.cmp?.j??""};cursor:pointer;transition:background .2s`)} onClick={v.pg?.cmp?.go}>
                    <span style={css("width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(10,16,32,.25)")} />
                  </span>
                </div>
              </>) : null}
            </>) : null}
            {(pn?.acts||[]).map((b,i6)=>(<React.Fragment key={i6}>
              <Hx as="span" s={`height:32px;padding:0 11px;border-radius:9px;background:${b?.bg??""};color:${b?.fg??""};border:1px solid ${b?.bd??""};box-shadow:0 1px 2px rgba(10,16,32,.06),inset 0 1px 0 rgba(255,255,255,.08);display:inline-flex;align-items:center;gap:7px;font:550 12.5px 'Geist';letter-spacing:-.005em;cursor:pointer;white-space:nowrap;transition:filter .15s,transform .1s`} h={"filter:brightness(.96)"} a={"transform:scale(.97)"} onClick={b?.go}>
                <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${b?.ic??""}) center/contain no-repeat;mask:url(${b?.ic??""}) center/contain no-repeat;`)} />
                {b?.n}
              </Hx>
            </React.Fragment>))}
          </div>
        </div>
        {' '}
        {pn?.isRep ? (<>
          {v.pg?.hasRepTabs ? (<>
            <div style={css("margin-top:16px;overflow-x:auto;scrollbar-width:none")}>
              <div style={css("display:inline-flex;gap:2px;padding:3px;border-radius:12px;background:#F2F4F7")}>
                {(v.pg?.tabs||[]).map((t,i8)=>(<React.Fragment key={i8}>
                  <span style={css(`flex:none;height:32px;padding:0 12px;border-radius:9px;display:grid;place-items:center;font:550 12.5px 'Geist';cursor:pointer;white-space:nowrap;background:${t?.bg??""};color:${t?.fg??""};box-shadow:${t?.sh??""}`)} onClick={t?.go}>
                    {t?.n}
                  </span>
                </React.Fragment>))}
              </div>
            </div>
          </>) : null}
        </>) : null}
        {' '}
        <div style={css("margin-top:16px")}>
          {pn?.isBars ? (<>
            <div style={css("display:flex;flex-direction:column;gap:16px")}>
              {(pn?.items||[]).map((it,i7)=>(<React.Fragment key={i7}>
                <div style={css("cursor:pointer")} onClick={it?.go}>
                  <div style={css("display:flex;justify-content:space-between;gap:10px;align-items:baseline")}>
                    <span style={css("font:550 13.5px 'Geist';min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                      {it?.l}
                    </span>
                    <span style={css("flex:none;font:600 13.5px 'Geist Mono';letter-spacing:-.02em")}>
                      {it?.v}
                    </span>
                  </div>
                  <div style={css("margin-top:8px;height:8px;border-radius:99px;background:#F2F4F7;overflow:hidden")}>
                    <span style={css(`display:block;height:100%;width:${it?.w??""};border-radius:99px;background:linear-gradient(90deg,${it?.c??""},${it?.c??""}CC);animation:grow .8s cubic-bezier(.2,.8,.2,1) both`)} />
                  </div>
                  <p style={css("margin-top:5px;font:400 11.5px 'Geist';color:#98A2B3")}>
                    {it?.s}
                  </p>
                </div>
              </React.Fragment>))}
            </div>
          </>) : null}
          {' '}
          {pn?.isList ? (<>
            <div style={css("display:flex;flex-direction:column;gap:4px")}>
              {(pn?.items||[]).map((it,i7)=>(<React.Fragment key={i7}>
                <Hx as="div" s={`display:flex;align-items:center;gap:12px;padding:10px;margin:0 -10px;border-radius:14px;cursor:${it?.cur??""};transition:background .12s`} h={"background:#FAFBFC"} onClick={it?.go}>
                  <span style={css(`flex:none;width:38px;height:38px;border-radius:12px;background:linear-gradient(160deg,#fff -40%,${it?.icBg??""} 100%);color:${it?.icFg??""};box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 0 rgba(16,24,40,.05),0 6px 12px -8px ${it?.icFg??""};display:grid;place-items:center`)}>
                    <span style={css(`flex:none;width:17px;height:17px;background:currentColor;-webkit-mask:url(${it?.ic??""}) center/contain no-repeat;mask:url(${it?.ic??""}) center/contain no-repeat;`)} />
                  </span>
                  <div style={css("flex:1;min-width:0")}>
                    <p style={css("font:550 13.5px/1.4 'Geist';letter-spacing:-.005em;text-wrap:pretty")}>
                      {it?.t}
                    </p>
                    <p style={css("margin-top:1px;font:400 12px 'Geist';color:#667085")}>
                      {it?.s}
                    </p>
                  </div>
                  {it?.hasBd ? (<>
                    <span style={css(`flex:none;height:24px;padding:0 9px;border-radius:8px;background:${it?.bdBg??""};color:${it?.bdFg??""};display:grid;place-items:center;font:550 11.5px 'Geist'`)}>
                      {it?.bdg}
                    </span>
                  </>) : null}
                  <div style={css("flex:none;text-align:right")}>
                    <p style={css(`font:600 13.5px 'Geist Mono';letter-spacing:-.02em;color:${it?.rFg??""}`)}>
                      {it?.r}
                    </p>
                    <p style={css("font:400 11px 'Geist';color:#98A2B3")}>
                      {it?.rs}
                    </p>
                  </div>
                  {it?.hasActs ? (<>
                    <div style={css("flex:none;display:flex;gap:6px")}>
                      {(it?.acts||[]).map((b,i11)=>(<React.Fragment key={i11}>
                        <Hx as="span" s={`height:32px;padding:0 11px;border-radius:9px;background:${b?.bg??""};color:${b?.fg??""};border:1px solid ${b?.bd??""};box-shadow:0 1px 2px rgba(10,16,32,.06),inset 0 1px 0 rgba(255,255,255,.08);display:inline-flex;align-items:center;gap:7px;font:550 12.5px 'Geist';letter-spacing:-.005em;cursor:pointer;white-space:nowrap;transition:filter .15s,transform .1s`} h={"filter:brightness(.96)"} a={"transform:scale(.97)"} onClick={b?.go}>
                          <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${b?.ic??""}) center/contain no-repeat;mask:url(${b?.ic??""}) center/contain no-repeat;`)} />
                          {b?.n}
                        </Hx>
                      </React.Fragment>))}
                    </div>
                  </>) : null}
                </Hx>
              </React.Fragment>))}
            </div>
          </>) : null}
          {' '}
          {pn?.isChart ? (<>
            <div>
              <div style={css("display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px")}>
                {(pn?.leg||[]).map((lg,i8)=>(<React.Fragment key={i8}>
                  <div style={css("padding:8px 12px;border-radius:12px;background:#FAFBFC;box-shadow:inset 0 0 0 1px #F0F2F5")}>
                    <p style={css("display:flex;align-items:center;gap:7px;font:500 12px 'Geist';color:#667085")}>
                      <span style={css(`width:8px;height:8px;border-radius:50%;background:${lg?.c??""}`)} />
                      {lg?.n}
                    </p>
                    <p style={css("margin-top:2px;font:600 16px 'Geist Mono';letter-spacing:-.03em")}>
                      {lg?.v}
                    </p>
                  </div>
                </React.Fragment>))}
              </div>
              {' '}
              <div style={css("position:relative;height:240px")}>
                <div style={css("position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none")}>
                  {(pn?.ticks||[]).map((tk,i9)=>(<React.Fragment key={i9}>
                    <div style={css("display:flex;align-items:center;gap:8px")}>
                      <span style={css("width:52px;font:500 10.5px 'Geist Mono';color:#98A2B3")}>
                        {tk?.v}
                      </span>
                      <span style={css("flex:1;border-top:1px dashed #EEF0F3")} />
                    </div>
                  </React.Fragment>))}
                  <div style={css("height:1px")} />
                </div>
                {' '}
                <svg style={css("position:absolute;left:60px;right:0;top:0;width:calc(100% - 60px);height:240px;overflow:visible")} viewBox="0 0 800 240" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#2DD4BF" stopOpacity=".32" />
                      <stop offset="1" stopColor="#2DD4BF" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#6366F1" stopOpacity=".18" />
                      <stop offset="1" stopColor="#6366F1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={pn?.ab} fill="url(#gb)" />
                  <path d={pn?.aa} fill="url(#ga)" />
                  <path d={pn?.db} fill="none" stroke="#6366F1" strokeWidth="2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                  <path style={css("stroke-dasharray:1;animation:draw 1.4s cubic-bezier(.2,.8,.2,1) both")} d={pn?.da} fill="none" stroke="#12B8A8" strokeWidth="2.4" vectorEffect="non-scaling-stroke" pathLength="1" />
                </svg>
              </div>
              {' '}
              <div style={css("margin-left:60px;margin-top:8px;display:flex;justify-content:space-between")}>
                {(pn?.items||[]).map((it,i8)=>(<React.Fragment key={i8}>
                  <span style={css("font:500 11px 'Geist';color:#98A2B3;cursor:default")} title={it?.tip}>
                    {it?.l}
                  </span>
                </React.Fragment>))}
              </div>
            </div>
          </>) : null}
          {' '}
          {pn?.isRep ? (<>
            <div style={css("border-radius:14px;box-shadow:inset 0 0 0 1px #F0F2F5;overflow:hidden")}>
              {(pn?.items||[]).map((it,i7)=>(<React.Fragment key={i7}>
                <Hx as="div" s={`display:flex;align-items:center;gap:16px;padding:12px 16px 12px calc(16px + ${it?.pl??""});border-top:${it?.bt??""};cursor:pointer;transition:background .12s`} h={"background:#FAFBFC"} onClick={it?.go}>
                  <span style={css(`flex:1;min-width:0;font:${it?.ft??""} 'Geist';letter-spacing:-.005em`)}>
                    {it?.l}
                  </span>
                  <span style={css(`width:150px;text-align:right;font:${it?.ft??""} 'Geist Mono';letter-spacing:-.02em;color:${it?.fg??""}`)}>
                    {it?.v}
                  </span>
                  {it?.show2 ? (<>
                    <span style={css(`width:150px;text-align:right;font:${it?.ft??""} 'Geist Mono';letter-spacing:-.02em;color:#98A2B3`)}>
                      {it?.v2}
                    </span>
                  </>) : null}
                </Hx>
              </React.Fragment>))}
            </div>
          </>) : null}
          {' '}
          {pn?.isForm ? (<>
            <div style={css("display:flex;flex-direction:column")}>
              {(pn?.items||[]).map((it,i7)=>(<React.Fragment key={i7}>
                <div style={css("display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #F2F4F7")}>
                  <div style={css("flex:1;min-width:0")}>
                    <p style={css("font:550 13.5px 'Geist'")}>
                      {it?.l}
                    </p>
                    <p style={css("font:400 12px 'Geist';color:#667085")}>
                      {it?.s}
                    </p>
                  </div>
                  {it?.isIn ? (<>
                    <input style={css("width:56%;height:40px;padding:0 12px;border-radius:11px;border:1px solid #E4E7EC;font:500 13.5px 'Geist';color:#0A1020")} value={it?.v} onChange={it?.on} />
                  </>) : null}
                  {it?.isSel ? (<>
                    <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${it?.dd?.bd??""};background:#fff;box-shadow:${it?.dd?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:56%`} h={"border-color:#99E6DA"} onClick={it?.dd?.open}>
                      {it?.dd?.hasIc ? (<>
                        <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${it?.dd?.icBg??""};color:${it?.dd?.icFg??""};display:grid;place-items:center`)}>
                          <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${it?.dd?.ic??""}) center/contain no-repeat;mask:url(${it?.dd?.ic??""}) center/contain no-repeat;`)} />
                        </span>
                      </>) : null}
                      <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${it?.dd?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                        {it?.dd?.label}
                      </span>
                      <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                    </Hx>
                  </>) : null}
                  {it?.isTg ? (<>
                    <span style={css(`flex:none;width:38px;height:22px;border-radius:99px;background:${it?.bg??""};padding:2px;display:flex;justify-content:${it?.j??""};cursor:pointer;transition:background .2s`)} onClick={it?.go}>
                      <span style={css("width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(10,16,32,.25)")} />
                    </span>
                  </>) : null}
                </div>
              </React.Fragment>))}
            </div>
          </>) : null}
          {' '}
          {pn?.isChk ? (<>
            <div style={css("display:flex;flex-direction:column;gap:6px")}>
              {(pn?.items||[]).map((it,i7)=>(<React.Fragment key={i7}>
                <div style={css("display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:14px;background:#FAFBFC;box-shadow:inset 0 0 0 1px #F0F2F5")}>
                  <span style={css(`flex:none;width:22px;height:22px;border-radius:7px;background:${it?.bg??""};border:1.5px solid ${it?.bd??""};display:grid;place-items:center;color:#fff;cursor:pointer;transition:all .15s`)} onClick={it?.tog}>
                    <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;")} />
                  </span>
                  <div style={css("flex:1;min-width:0")}>
                    <p style={css(`font:550 14px 'Geist';color:${it?.fg??""};text-decoration:${it?.dec??""}`)}>
                      {it?.t}
                    </p>
                    <p style={css("font:400 12px 'Geist';color:#98A2B3")}>
                      {it?.s}
                    </p>
                  </div>
                  <span style={css("display:flex;align-items:center;gap:4px;font:550 12.5px 'Geist';color:#0B7A6F;cursor:pointer")} onClick={it?.open}>
                    {it?.openL}
                    <span style={css("flex:none;width:13px;height:13px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/arrow-up-right.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/arrow-up-right.svg) center/contain no-repeat;")} />
                  </span>
                </div>
              </React.Fragment>))}
            </div>
          </>) : null}
          {' '}
          {pn?.isKanban ? (<>
            <div style={css("display:grid;grid-template-columns:repeat(4,minmax(240px,1fr));gap:14px;overflow-x:auto;padding-bottom:4px")}>
              {(pn?.items||[]).map((kc,i7)=>(<React.Fragment key={i7}>
                <div style={css("min-width:0;padding:12px;border-radius:18px;background:#F5F7F9;box-shadow:inset 0 0 0 1px #EEF0F3")}>
                  <div style={css("display:flex;align-items:center;gap:8px;padding:2px 4px 10px")}>
                    <span style={css(`width:8px;height:8px;border-radius:50%;background:${kc?.c??""}`)} />
                    <p style={css("flex:1;font:600 13.5px 'Geist'")}>
                      {kc?.n}
                    </p>
                    <span style={css("height:20px;min-width:22px;padding:0 6px;border-radius:6px;background:#fff;display:grid;place-items:center;font:600 11px 'Geist Mono';color:#475467")}>
                      {kc?.cnt}
                    </span>
                  </div>
                  <div style={css("display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 360px);overflow-y:auto")}>
                    {(kc?.cards||[]).map((cd,i10)=>(<React.Fragment key={i10}>
                      <Hx as="div" s={"padding:12px;border-radius:14px;background:#fff;border:1px solid rgba(16,24,40,.06);box-shadow:inset 0 1px 0 #fff,0 6px 14px -10px rgba(16,24,40,.3);cursor:pointer;transition:transform .15s,box-shadow .15s;animation:rise .25s ease both"} h={"transform:translateY(-2px);box-shadow:inset 0 1px 0 #fff,0 14px 24px -14px rgba(16,24,40,.35)"} onClick={cd?.go}>
                        <div style={css("display:flex;align-items:center;gap:6px")}>
                          <span style={css(`height:20px;padding:0 7px;border-radius:6px;background:${cd?.prBg??""};color:${cd?.prFg??""};display:grid;place-items:center;font:600 10.5px 'Geist'`)}>
                            {cd?.pr}
                          </span>
                          <span style={css("margin-left:auto;display:flex;align-items:center;gap:4px;font:500 11.5px 'Geist';color:#667085")}>
                            <span style={css("flex:none;width:12px;height:12px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/calendar-blank-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/calendar-blank-duotone.svg) center/contain no-repeat;")} />
                            {cd?.due}
                          </span>
                        </div>
                        <p style={css("margin-top:8px;font:600 13.5px/1.35 'Geist';letter-spacing:-.005em")}>
                          {cd?.t}
                        </p>
                        <p style={css("margin-top:2px;font:400 12px 'Geist';color:#667085")}>
                          {cd?.cl}
                        </p>
                        <div style={css("margin-top:10px;display:flex;align-items:center;gap:8px")}>
                          <div style={css("flex:1;height:5px;border-radius:99px;background:#F2F4F7;overflow:hidden")}>
                            <span style={css(`display:block;height:100%;width:${cd?.w??""};border-radius:99px;background:linear-gradient(90deg,#5EEAD4,#12B8A8)`)} />
                          </div>
                          <span style={css("font:500 11px 'Geist Mono';color:#98A2B3")}>
                            {cd?.prog}
                          </span>
                          <span style={css("width:24px;height:24px;border-radius:8px;background:#E0E7FF;color:#3730A3;display:grid;place-items:center;font:650 10px 'Geist'")} title={cd?.who}>
                            {cd?.ini}
                          </span>
                        </div>
                        <div style={css("margin-top:10px;display:flex;justify-content:space-between")}>
                          {cd?.hasL ? (<>
                            <span style={css("height:26px;padding:0 8px;border-radius:8px;background:#F5F6F8;display:flex;align-items:center;gap:4px;font:550 11.5px 'Geist';color:#475467;cursor:pointer")} onClick={cd?.left}>
                              <span style={css("flex:none;width:12px;height:12px;background:currentColor;-webkit-mask:url(https://unpkg.com/lucide-static@0.460.0/icons/caret-left.svg) center/contain no-repeat;mask:url(https://unpkg.com/lucide-static@0.460.0/icons/caret-left.svg) center/contain no-repeat;")} />
                              Back
                            </span>
                          </>) : null}
                          <span />
                          {cd?.hasR ? (<>
                            <span style={css("height:26px;padding:0 8px;border-radius:8px;background:#F0FDFA;display:flex;align-items:center;gap:4px;font:550 11.5px 'Geist';color:#0B6B61;cursor:pointer")} onClick={cd?.right}>
                              Move on
                              <span style={css("flex:none;width:12px;height:12px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-right.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-right.svg) center/contain no-repeat;")} />
                            </span>
                          </>) : null}
                        </div>
                      </Hx>
                    </React.Fragment>))}
                  </div>
                </div>
              </React.Fragment>))}
            </div>
          </>) : null}
          {' '}
          {pn?.isCal ? (<>
            <div>
              <div style={css("display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px")}>
                {(pn?.wk||[]).map((wd,i8)=>(<React.Fragment key={i8}>
                  <span style={css("text-align:center;font:550 11.5px 'Geist';color:#98A2B3")}>
                    {wd?.n}
                  </span>
                </React.Fragment>))}
              </div>
              <div style={css("display:flex;flex-direction:column;gap:6px")}>
                {(pn?.items||[]).map((wr,i8)=>(<React.Fragment key={i8}>
                  <div style={css("display:grid;grid-template-columns:repeat(7,1fr);gap:6px")}>
                    {(wr?.days||[]).map((dy,i10)=>(<React.Fragment key={i10}>
                      <Hx as="div" s={`min-height:74px;padding:8px;border-radius:12px;background:${dy?.bg??""};border:1.5px solid ${dy?.bd??""};opacity:${dy?.op??""};cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;transition:transform .12s`} h={"transform:translateY(-1px)"} onClick={dy?.go}>
                        <div style={css("display:flex;justify-content:space-between;align-items:center")}>
                          <span style={css("font:600 13px 'Geist Mono'")}>
                            {dy?.d}
                          </span>
                          {dy?.has ? (<>
                            <span style={css("height:18px;min-width:18px;padding:0 5px;border-radius:6px;background:#0A1020;color:#fff;display:grid;place-items:center;font:600 10px 'Geist Mono'")}>
                              {dy?.cnt}
                            </span>
                          </>) : null}
                        </div>
                        <div style={css("display:flex;gap:3px;flex-wrap:wrap")}>
                          {(dy?.dots||[]).map((dt,i13)=>(<React.Fragment key={i13}>
                            <span style={css(`width:7px;height:7px;border-radius:50%;background:${dt?.c??""}`)} />
                          </React.Fragment>))}
                        </div>
                      </Hx>
                    </React.Fragment>))}
                  </div>
                </React.Fragment>))}
              </div>
            </div>
          </>) : null}
          {' '}
          {pn?.isTree ? (<>
            <div style={css("border-radius:16px;box-shadow:inset 0 0 0 1px #EEF0F3;overflow:auto;max-height:calc(100vh - 290px)")}>
              <div style={css("min-width:680px")}>
                <div style={css("position:sticky;top:0;z-index:2;display:grid;grid-template-columns:minmax(300px,1fr) 170px 150px;align-items:center;height:42px;padding:0 16px;background:rgba(250,251,252,.97);backdrop-filter:blur(6px);border-bottom:1px solid #EEF0F3;font:550 11.5px 'Geist';color:#667085")}>
                  <span>
                    Name
                  </span>
                  <span>
                    {pn?.tc1}
                  </span>
                  <span style={css("text-align:right")}>
                    {pn?.tc2}
                  </span>
                </div>
                {' '}
                {(pn?.items||[]).map((tn,i8)=>(<React.Fragment key={i8}>
                  <Hx as="div" s={`display:grid;grid-template-columns:minmax(300px,1fr) 170px 150px;align-items:center;min-height:52px;padding:0 16px;border-bottom:1px solid #F4F5F7;background:${tn?.bg??""};box-shadow:${tn?.bd??""};cursor:pointer;animation:fade .2s ease both`} h={"background:#FAFCFC"} onClick={tn?.go}>
                    <div style={css(`min-width:0;display:flex;align-items:center;gap:10px;padding-left:${tn?.pl??""}`)}>
                      {tn?.hasKids ? (<>
                        <Hx as="span" s={"flex:none;width:22px;height:22px;border-radius:7px;display:grid;place-items:center;color:#667085;cursor:pointer"} h={"background:#EEF0F3"} onClick={tn?.toggle}>
                          <span style={css(`display:grid;transform:${tn?.rot??""};transition:transform .2s`)}>
                            <span style={css("flex:none;width:13px;height:13px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-down.svg) center/contain no-repeat;")} />
                          </span>
                        </Hx>
                      </>) : null}
                      {tn?.noKids ? (<>
                        <span style={css("flex:none;width:22px")} />
                      </>) : null}
                      <span style={css(`flex:none;width:32px;height:32px;border-radius:10px;background:linear-gradient(160deg,#fff -40%,${tn?.icBg??""} 100%);color:${tn?.icFg??""};box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 0 0 1px rgba(16,24,40,.05);display:grid;place-items:center`)}>
                        <span style={css(`flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(${tn?.ic??""}) center/contain no-repeat;mask:url(${tn?.ic??""}) center/contain no-repeat;`)} />
                      </span>
                      <div style={css("min-width:0")}>
                        <p style={css(`font:${tn?.fw??""} 13.5px 'Geist';letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                          {tn?.n}
                        </p>
                        <p style={css("font:400 11.5px 'Geist';color:#98A2B3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                          {tn?.s}
                        </p>
                      </div>
                      {tn?.hasBd ? (<>
                        <span style={css(`flex:none;height:20px;padding:0 7px;border-radius:6px;background:${tn?.icBg??""};color:${tn?.icFg??""};display:grid;place-items:center;font:600 10.5px 'Geist'`)}>
                          {tn?.bdg}
                        </span>
                      </>) : null}
                      {tn?.hasKids ? (<>
                        <span style={css("flex:none;height:20px;min-width:22px;padding:0 6px;border-radius:6px;background:#F2F4F7;color:#667085;display:grid;place-items:center;font:600 10.5px 'Geist Mono'")}>
                          {tn?.kc}
                        </span>
                      </>) : null}
                    </div>
                    <span style={css("font:500 12.5px 'Geist Mono';color:#475467;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                      {tn?.c1}
                    </span>
                    <span style={css(`text-align:right;font:600 13px 'Geist Mono';letter-spacing:-.02em;color:${tn?.c1Fg??""}`)}>
                      {tn?.c2}
                    </span>
                  </Hx>
                </React.Fragment>))}
              </div>
            </div>
          </>) : null}
          {' '}
          {pn?.isMatrix ? (<>
            <div style={css("border-radius:16px;box-shadow:inset 0 0 0 1px #EEF0F3;overflow:auto;max-height:620px")}>
              <div style={css("min-width:820px")}>
                <div style={css("position:sticky;top:0;z-index:2;display:grid;grid-template-columns:minmax(220px,1fr) repeat(7,88px);align-items:center;height:44px;padding:0 16px;background:rgba(250,251,252,.96);backdrop-filter:blur(6px);border-bottom:1px solid #EEF0F3")}>
                  <span style={css("font:550 11.5px 'Geist';color:#667085")}>
                    Module
                  </span>
                  {(pn?.cols||[]).map((cl,i9)=>(<React.Fragment key={i9}>
                    <span style={css("text-align:center;font:550 11.5px 'Geist';color:#667085")}>
                      {cl?.n}
                    </span>
                  </React.Fragment>))}
                </div>
                {' '}
                {(pn?.items||[]).map((rw,i8)=>(<React.Fragment key={i8}>
                  <div>
                    {rw?.isSec ? (<>
                      <div style={css("display:flex;align-items:center;gap:10px;height:44px;padding:0 16px;background:#FAFBFC;border-bottom:1px solid #F2F4F7")}>
                        <span style={css(`display:grid;transform:${rw?.rot??""};transition:transform .2s;color:#98A2B3;cursor:pointer`)} onClick={rw?.toggle}>
                          <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-down.svg) center/contain no-repeat;")} />
                        </span>
                        <span style={css("display:grid;color:#0B7A6F")}>
                          <span style={css(`flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(${rw?.ic??""}) center/contain no-repeat;mask:url(${rw?.ic??""}) center/contain no-repeat;`)} />
                        </span>
                        <span style={css("flex:1;font:600 13.5px 'Geist';cursor:pointer")} onClick={rw?.toggle}>
                          {rw?.n}{" "}
                          <span style={css("font:400 12px 'Geist';color:#98A2B3")}>
                            {"· "}{rw?.s}
                          </span>
                        </span>
                        <span style={css("font:550 12px 'Geist';color:#0B7A6F;cursor:pointer")} onClick={rw?.all}>
                          {rw?.allL}
                        </span>
                      </div>
                    </>) : null}
                    {' '}
                    {rw?.isRow ? (<>
                      <Hx as="div" s={"display:grid;grid-template-columns:minmax(220px,1fr) repeat(7,88px);align-items:center;height:46px;padding:0 16px 0 44px;border-bottom:1px solid #F4F5F7"} h={"background:#FCFDFD"}>
                        <span style={css("display:flex;align-items:center;gap:10px;font:500 13px 'Geist';color:#344054")}>
                          <span style={css("display:grid;color:#98A2B3")}>
                            <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${rw?.ic??""}) center/contain no-repeat;mask:url(${rw?.ic??""}) center/contain no-repeat;`)} />
                          </span>
                          {rw?.n}
                        </span>
                        {(rw?.cells||[]).map((ce,i12)=>(<React.Fragment key={i12}>
                          <span style={css("display:grid;place-items:center")}>
                            {ce?.na ? (<>
                              <span style={css("width:12px;height:2px;border-radius:2px;background:#E4E7EC")} />
                            </>) : null}
                            {ce?.on ? (<>
                              <Hx as="span" s={`width:22px;height:22px;border-radius:7px;background:${ce?.bg??""};border:1.5px solid ${ce?.bd??""};color:#fff;display:grid;place-items:center;cursor:pointer;opacity:${ce?.op??""};box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 4px 8px -4px rgba(18,184,168,.8);transition:transform .1s`} a={"transform:scale(.88)"} onClick={ce?.go}>
                                <span style={css("flex:none;width:13px;height:13px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;")} />
                              </Hx>
                            </>) : null}
                            {ce?.off ? (<>
                              <Hx as="span" s={`width:22px;height:22px;border-radius:7px;background:#fff;border:1.5px solid #D0D5DD;cursor:pointer;opacity:${ce?.op??""};transition:border-color .15s`} h={"border-color:#12B8A8"} onClick={ce?.go} />
                            </>) : null}
                          </span>
                        </React.Fragment>))}
                      </Hx>
                    </>) : null}
                  </div>
                </React.Fragment>))}
              </div>
            </div>
          </>) : null}
          {' '}
          {pn?.isDonut ? (<>
            <div style={css("display:flex;align-items:center;gap:24px;flex-wrap:wrap")}>
              <div style={css("position:relative;width:180px;height:180px;flex:none")}>
                <svg style={css("width:180px;height:180px;transform:rotate(-90deg)")} viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#F2F4F7" strokeWidth="12" />
                  {(pn?.items||[]).map((dn,i9)=>(<React.Fragment key={i9}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke={dn?.c} strokeWidth="12" strokeDasharray={dn?.dash} strokeDashoffset={dn?.off} />
                  </React.Fragment>))}
                </svg>
                <div style={css("position:absolute;inset:0;display:grid;place-items:center;text-align:center")}>
                  <div>
                    <p style={css("font:600 20px 'Geist Mono';letter-spacing:-.04em")}>
                      {pn?.ctr}
                    </p>
                    <p style={css("font:500 11.5px 'Geist';color:#98A2B3")}>
                      {pn?.ctrS}
                    </p>
                  </div>
                </div>
              </div>
              <div style={css("flex:1;min-width:160px;display:flex;flex-direction:column;gap:10px")}>
                {(pn?.items||[]).map((dn,i8)=>(<React.Fragment key={i8}>
                  <div style={css("display:flex;align-items:center;gap:10px")}>
                    <span style={css(`width:10px;height:10px;border-radius:3px;background:${dn?.c??""}`)} />
                    <span style={css("flex:1;font:500 13px 'Geist';color:#344054")}>
                      {dn?.n}
                    </span>
                    <span style={css("font:600 13px 'Geist Mono'")}>
                      {dn?.v}
                    </span>
                  </div>
                </React.Fragment>))}
              </div>
            </div>
          </>) : null}
          {' '}
          {pn?.isGauge ? (<>
            <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px")}>
              {(pn?.items||[]).map((gg,i7)=>(<React.Fragment key={i7}>
                <div style={css("padding:14px;border-radius:16px;background:#FAFBFC;box-shadow:inset 0 0 0 1px #F0F2F5;text-align:center")}>
                  <svg style={css("width:100%;max-width:150px;height:auto")} viewBox="0 0 120 66">
                    <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#EEF0F3" strokeWidth="10" strokeLinecap="round" />
                    <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke={gg?.c} strokeWidth="10" strokeLinecap="round" strokeDasharray={gg?.dash} />
                  </svg>
                  <p style={css("margin-top:-6px;font:600 20px 'Geist Mono';letter-spacing:-.04em")}>
                    {gg?.v}
                  </p>
                  <p style={css("margin-top:2px;font:550 12.5px 'Geist'")}>
                    {gg?.l}
                  </p>
                  <p style={css("font:400 11.5px 'Geist';color:#98A2B3")}>
                    {gg?.sub}
                  </p>
                </div>
              </React.Fragment>))}
            </div>
          </>) : null}
          {' '}
          {pn?.isWf ? (<>
            <div style={css("display:flex;align-items:stretch;gap:10px;height:240px;padding-top:8px")}>
              {(pn?.items||[]).map((w,i7)=>(<React.Fragment key={i7}>
                <div style={css("flex:1;min-width:0;display:flex;flex-direction:column")}>
                  <div style={css("position:relative;flex:1")}>
                    <span style={css(`position:absolute;left:12%;right:12%;bottom:${w?.b??""};height:${w?.h??""};border-radius:8px;background:${w?.c??""};box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 8px 16px -10px ${w?.c??""};animation:rise .6s ease both`)} />
                  </div>
                  <p style={css("margin-top:8px;text-align:center;font:600 12px 'Geist Mono';letter-spacing:-.02em")}>
                    {w?.v}
                  </p>
                  <p style={css("margin-top:2px;text-align:center;font:500 11px/1.25 'Geist';color:#667085")}>
                    {w?.l}
                  </p>
                </div>
              </React.Fragment>))}
            </div>
          </>) : null}
          {' '}
          {pn?.isHeat ? (<>
            <div style={css("display:flex;flex-direction:column;gap:6px")}>
              {(pn?.items||[]).map((hr,i7)=>(<React.Fragment key={i7}>
                <div style={css("display:flex;align-items:center;gap:6px")}>
                  <span style={css("width:34px;font:500 11.5px 'Geist';color:#98A2B3")}>
                    {hr?.d}
                  </span>
                  {(hr?.cells||[]).map((hc,i9)=>(<React.Fragment key={i9}>
                    <span style={css(`flex:1;height:26px;border-radius:7px;background:${hc?.bg??""};box-shadow:inset 0 0 0 1px rgba(16,24,40,.04)`)} title={hc?.tip} />
                  </React.Fragment>))}
                </div>
              </React.Fragment>))}
            </div>
          </>) : null}
          {' '}
          {pn?.isTrace ? (<>
            <div style={css("display:flex;flex-direction:column")}>
              {(pn?.items||[]).map((te,i7)=>(<React.Fragment key={i7}>
                <div style={css("display:flex;gap:14px")}>
                  <div style={css("flex:none;display:flex;flex-direction:column;align-items:center")}>
                    <span style={css(`width:34px;height:34px;border-radius:11px;background:${te?.bg??""};color:${te?.fg??""};display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(16,24,40,.05)`)}>
                      <span style={css(`flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(${te?.ic??""}) center/contain no-repeat;mask:url(${te?.ic??""}) center/contain no-repeat;`)} />
                    </span>
                    <span style={css(`flex:1;width:2px;min-height:18px;margin:4px 0;border-radius:2px;background:#EEF0F3;display:${te?.last??""}`)} />
                  </div>
                  <div style={css("flex:1;min-width:0;padding-bottom:16px")}>
                    <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                      <p style={css("font:550 13.5px 'Geist'")}>
                        {te?.t}
                      </p>
                      <span style={css(`height:20px;padding:0 7px;border-radius:6px;background:${te?.bg??""};color:${te?.fg??""};display:grid;place-items:center;font:600 10.5px 'Geist Mono'`)}>
                        {te?.stL}
                      </span>
                    </div>
                    <p style={css("margin-top:3px;font:400 12px 'Geist';color:#667085")}>
                      {te?.svc}{" · "}{te?.who}{" · "}{te?.w}{" · "}
                      <span style={css("font-family:'Geist Mono'")}>
                        {te?.ms}
                      </span>
                    </p>
                  </div>
                </div>
              </React.Fragment>))}
            </div>
          </>) : null}
          {' '}
          {pn?.empty ? (<>
            <div style={css("padding:28px;text-align:center;font:550 13.5px 'Geist';color:#067647")}>
              {pn?.emptyT}
            </div>
          </>) : null}
        </div>
      </section>
  );
}
