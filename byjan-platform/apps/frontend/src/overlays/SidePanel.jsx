import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';

export default function SidePanel({ v }) {
  return (
    <>
      <div style={css("position:absolute;inset:0;z-index:25;display:flex;justify-content:flex-end;padding:12px")}>
        <div style={css("position:absolute;inset:0;background:rgba(10,16,32,.28);backdrop-filter:blur(2px);animation:fade .2s ease both")} onClick={v.fly?.close} />
        {' '}
        <div style={css("position:relative;width:560px;max-width:100%;height:100%;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 40px 80px -30px rgba(10,16,32,.55),0 0 0 1px rgba(10,16,32,.06);display:flex;flex-direction:column;animation:slideIn .25s ease both")}>
          {v.fly?.isDoc ? (<>
            <div style={css("flex:1;min-height:0;display:flex;flex-direction:column")}>
              <div style={css("flex:none;padding:18px 22px 16px;border-bottom:1px solid #EEF1F5")}>
                <div style={css("display:flex;align-items:center;gap:10px")}>
                  <span style={css("font:600 12px 'Geist';letter-spacing:.06em;color:#667085;text-transform:uppercase")}>
                    {v.fly?.typ}
                  </span>
                  <span style={css(`height:24px;padding:0 10px;border-radius:99px;background:${v.fly?.stBg??""};color:${v.fly?.stFg??""};display:grid;place-items:center;font:600 11.5px 'Geist'`)}>
                    {v.fly?.st}
                  </span>
                  <Hx as="span" s={"margin-left:auto;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;cursor:pointer;color:#475467"} h={"background:#F5F6F8"} onClick={v.fly?.close}>
                    <span style={css("flex:none;width:18px;height:18px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;")} />
                  </Hx>
                </div>
                {' '}
                <div style={css("margin-top:8px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px")}>
                  <div style={css("min-width:0")}>
                    <h2 style={css("font:650 24px 'Geist';letter-spacing:-.02em")}>
                      {v.fly?.no}
                    </h2>
                    <p style={css("margin-top:4px;font:600 14px 'Geist';color:#0B7A6F;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")} onClick={v.fly?.pGo}>
                      {v.fly?.party}
                    </p>
                    <p style={css("font:500 12px 'Geist';color:#667085")}>
                      {v.fly?.pSub}
                    </p>
                  </div>
                  <div style={css("flex:none;text-align:right")}>
                    <p style={css("font:500 12px 'Geist';color:#667085")}>
                      {v.fly?.bigL}
                    </p>
                    <p style={css("font:600 26px 'Geist Mono';letter-spacing:-.045em")}>
                      {v.fly?.big}
                    </p>
                  </div>
                </div>
                {' '}
                {v.fly?.hasProg ? (<>
                  <div style={css("margin-top:12px")}>
                    <div style={css("height:6px;border-radius:99px;background:#EEF1F5;overflow:hidden")}>
                      <span style={css(`display:block;height:100%;width:${v.fly?.prog??""};background:#12B8A8;border-radius:99px;animation:grow .6s ease both`)} />
                    </div>
                    <p style={css("margin-top:5px;font:500 11.5px 'Geist';color:#667085")}>
                      {v.fly?.progL}
                    </p>
                  </div>
                </>) : null}
                {' '}
                <div style={css("margin-top:14px;display:flex;gap:8px;flex-wrap:wrap")}>
                  {(v.fly?.pv||[]).map((b,i9)=>(<React.Fragment key={i9}>
                    <Hx as="span" s={`height:36px;padding:0 14px;border-radius:11px;background:${b?.bg??""};color:${b?.fg??""};border:1px solid ${b?.bd??""};display:inline-flex;align-items:center;gap:7px;font:600 13px 'Geist';cursor:pointer;white-space:nowrap;transition:filter .15s,transform .1s`} h={"filter:brightness(.95)"} a={"transform:scale(.97)"} onClick={b?.go}>
                      <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${b?.ic??""}) center/contain no-repeat;mask:url(${b?.ic??""}) center/contain no-repeat;`)} />
                      {b?.n}
                    </Hx>
                  </React.Fragment>))}
                  {(v.fly?.more||[]).map((b,i9)=>(<React.Fragment key={i9}>
                    <Hx as="span" s={`height:36px;padding:0 14px;border-radius:11px;background:${b?.bg??""};color:${b?.fg??""};border:1px solid ${b?.bd??""};display:inline-flex;align-items:center;gap:7px;font:600 13px 'Geist';cursor:pointer;white-space:nowrap;transition:filter .15s,transform .1s`} h={"filter:brightness(.95)"} a={"transform:scale(.97)"} onClick={b?.go}>
                      <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${b?.ic??""}) center/contain no-repeat;mask:url(${b?.ic??""}) center/contain no-repeat;`)} />
                      {b?.n}
                    </Hx>
                  </React.Fragment>))}
                </div>
                {' '}
                <div style={css("margin-top:16px;display:flex;align-items:flex-start")}>
                  {(v.fly?.life||[]).map((lf,i9)=>(<React.Fragment key={i9}>
                    <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px;position:relative")}>
                      <span style={css(`position:absolute;top:10px;left:-50%;width:100%;height:2px;background:${lf?.ln??""};display:${lf?.lnD??""}`)} />
                      <span style={css(`position:relative;width:22px;height:22px;border-radius:50%;background:${lf?.bg??""};border:2px solid ${lf?.bd??""};color:#fff;display:grid;place-items:center;box-shadow:${lf?.sh??""}`)}>
                        <span style={css("flex:none;width:12px;height:12px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;")} />
                      </span>
                      <span style={css(`font:550 11px 'Geist';color:${lf?.fg??""};text-align:center;white-space:nowrap`)}>
                        {lf?.n}
                      </span>
                    </div>
                  </React.Fragment>))}
                </div>
                {' '}
                {v.fly?.hasNext ? (<>
                  <div style={css("margin-top:14px;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:linear-gradient(135deg,#F0FDFA,#EEF4FF);border:1px solid rgba(18,184,168,.2);box-shadow:inset 0 1px 0 #fff")}>
                    <span style={css("flex:none;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(160deg,#fff -40%,#CCFBF1 100%);color:#0B7A6F;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 0 rgba(16,24,40,.05),0 4px 10px -4px #0B7A6F55")}>
                      <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/sparkle-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/sparkle-duotone.svg) center/contain no-repeat;")} />
                    </span>
                    <div style={css("flex:1;min-width:0")}>
                      <p style={css("font:600 13px 'Geist';color:#0B1F3A")}>
                        {v.fly?.nextT}
                      </p>
                      <p style={css("font:400 12px 'Geist';color:#667085")}>
                        {v.fly?.nextS}
                      </p>
                    </div>
                    <span style={css("flex:none;height:34px;padding:0 12px;border-radius:10px;background:linear-gradient(180deg,#22C7B5,#0FA898);color:#fff;display:flex;align-items:center;gap:6px;font:600 12.5px 'Geist';cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 6px 12px -8px rgba(15,168,152,.9)")} onClick={v.fly?.nextGo}>
                      {v.fly?.nextL}
                      <span style={css("flex:none;width:13px;height:13px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/arrow-right.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/arrow-right.svg) center/contain no-repeat;")} />
                    </span>
                  </div>
                </>) : null}
                {' '}
                <div style={css("margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;border-radius:11px;background:#F2F4F7")}>
                  {(v.fly?.tabs||[]).map((t,i9)=>(<React.Fragment key={i9}>
                    <span style={css(`height:32px;border-radius:8px;background:${t?.bg??""};color:${t?.fg??""};box-shadow:${t?.sh??""};display:grid;place-items:center;font:600 12.5px 'Geist';cursor:pointer`)} onClick={t?.go}>
                      {t?.n}
                    </span>
                  </React.Fragment>))}
                </div>
              </div>
              {' '}
              <div style={css("flex:1;min-height:0;overflow-y:auto;padding:18px 22px 28px")}>
                {v.fly?.isDet ? (<>
                  <div style={css("animation:fade .2s ease both")}>
                    <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:12px")}>
                      {(v.fly?.meta||[]).map((mt,i11)=>(<React.Fragment key={i11}>
                        <div>
                          <p style={css("font:500 11.5px 'Geist';color:#98A2B3")}>
                            {mt?.l}
                          </p>
                          <p style={css(`margin-top:2px;font:600 13.5px 'Geist';color:${mt?.fg??""}`)}>
                            {mt?.v}
                          </p>
                        </div>
                      </React.Fragment>))}
                    </div>
                    {' '}
                    <div style={css("margin-top:18px;border:1px solid #EEF1F5;border-radius:12px;overflow:hidden")}>
                      {(v.fly?.lines||[]).map((ln,i11)=>(<React.Fragment key={i11}>
                        <div style={css("display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid #F2F4F7")}>
                          <div style={css("flex:1;min-width:0")}>
                            <p style={css("font:600 13.5px 'Geist'")}>
                              {ln?.n}
                            </p>
                            <p style={css("font:500 11.5px 'Geist';color:#98A2B3")}>
                              {ln?.s}
                            </p>
                          </div>
                          <span style={css("font:500 12.5px 'Geist';color:#667085;white-space:nowrap")}>
                            {ln?.q}{" "}{ln?.r}
                          </span>
                          <span style={css("width:110px;text-align:right;font:650 13.5px 'Geist';font-variant-numeric:tabular-nums")}>
                            {ln?.a}
                          </span>
                        </div>
                      </React.Fragment>))}
                      {' '}
                      <div style={css("padding:12px 14px;background:#F8FAFB;display:flex;flex-direction:column;gap:6px")}>
                        {(v.fly?.tot||[]).map((tt,i12)=>(<React.Fragment key={i12}>
                          <div style={css(`display:flex;justify-content:space-between;padding-top:${tt?.pt??""};border-top:${tt?.bt??""};font:${tt?.ft??""} 'Geist';font-variant-numeric:tabular-nums`)}>
                            <span>
                              {tt?.l}
                            </span>
                            <span>
                              {tt?.v}
                            </span>
                          </div>
                        </React.Fragment>))}
                      </div>
                    </div>
                    {' '}
                    {v.fly?.hasNotes ? (<>
                      <p style={css("margin-top:14px;padding:12px 14px;border-radius:12px;background:#FFFBEB;font:500 13px/1.5 'Geist';color:#5B4600")}>
                        {v.fly?.notes}
                      </p>
                    </>) : null}
                  </div>
                </>) : null}
                {' '}
                {v.fly?.isAcc ? (<>
                  <div style={css("animation:fade .2s ease both")}>
                    <p style={css("font:500 12.5px/1.5 'Geist';color:#667085")}>
                      How this is recorded in your accounts.
                    </p>
                    <div style={css("margin-top:12px;border:1px solid #EEF1F5;border-radius:12px;overflow:hidden")}>
                      <div style={css("display:grid;grid-template-columns:1fr 110px 110px;gap:10px;padding:9px 14px;background:#F8FAFB;font:600 11px 'Geist';letter-spacing:.04em;color:#667085")}>
                        <span>
                          ACCOUNT
                        </span>
                        <span style={css("text-align:right")}>
                          DEBIT
                        </span>
                        <span style={css("text-align:right")}>
                          CREDIT
                        </span>
                      </div>
                      {(v.fly?.acct||[]).map((a,i11)=>(<React.Fragment key={i11}>
                        <div style={css("display:grid;grid-template-columns:1fr 110px 110px;gap:10px;padding:11px 14px;border-top:1px solid #F2F4F7;font:500 13px 'Geist';font-variant-numeric:tabular-nums")}>
                          <span style={css("min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                            {a?.a}
                          </span>
                          <span style={css("text-align:right")}>
                            {a?.dr}
                          </span>
                          <span style={css("text-align:right")}>
                            {a?.cr}
                          </span>
                        </div>
                      </React.Fragment>))}
                    </div>
                  </div>
                </>) : null}
                {' '}
                {v.fly?.isAct ? (<>
                  <div style={css("animation:fade .2s ease both")}>
                    {(v.fly?.act||[]).map((a,i10)=>(<React.Fragment key={i10}>
                      <div style={css("display:flex;gap:12px;padding-bottom:16px;position:relative")}>
                        <span style={css("flex:none;width:30px;height:30px;border-radius:50%;background:#E3F7F4;color:#0B7A6F;display:grid;place-items:center")}>
                          <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${a?.ic??""}) center/contain no-repeat;mask:url(${a?.ic??""}) center/contain no-repeat;`)} />
                        </span>
                        <div>
                          <p style={css("font:500 13.5px/1.4 'Geist'")}>
                            {a?.t}
                          </p>
                          <p style={css("font:500 11.5px 'Geist';color:#98A2B3")}>
                            {a?.w}
                          </p>
                        </div>
                      </div>
                    </React.Fragment>))}
                  </div>
                </>) : null}
              </div>
            </div>
          </>) : null}
          {' '}
          {v.fly?.isUser ? (<>
            <div style={css("flex:1;min-height:0;overflow-y:auto;padding:20px 22px 28px")}>
              <div style={css("display:flex;align-items:center;gap:14px")}>
                <span style={css(`flex:none;width:56px;height:56px;border-radius:18px;background:linear-gradient(160deg,#fff -40%,${v.fly?.avBg??""} 100%);display:grid;place-items:center;font:650 18px 'Geist';box-shadow:inset 0 1px 0 #fff,0 10px 20px -12px ${v.fly?.rc??""}`)}>
                  {v.fly?.ini}
                </span>
                <div style={css("flex:1;min-width:0")}>
                  <h2 style={css("font:650 21px 'Geist';letter-spacing:-.02em")}>
                    {v.fly?.n}
                  </h2>
                  <p style={css("font:400 13px 'Geist';color:#667085")}>
                    {v.fly?.e}
                  </p>
                  <div style={css("margin-top:6px;display:flex;gap:6px")}>
                    <span style={css(`height:22px;padding:0 8px;border-radius:7px;background:${v.fly?.rbg??""};color:${v.fly?.rc??""};display:grid;place-items:center;font:600 11.5px 'Geist'`)}>
                      {v.fly?.role}
                    </span>
                    <span style={css("height:22px;padding:0 8px;border-radius:7px;background:#F2F4F7;color:#475467;display:grid;place-items:center;font:550 11.5px 'Geist'")}>
                      {v.fly?.st}
                    </span>
                  </div>
                </div>
                <Hx as="span" s={"align-self:flex-start;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;cursor:pointer;color:#475467"} h={"background:#F5F6F8"} onClick={v.fly?.close}>
                  <span style={css("flex:none;width:18px;height:18px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;")} />
                </Hx>
              </div>
              {' '}
              <div style={css("margin-top:16px;display:flex;gap:8px;flex-wrap:wrap")}>
                {(v.fly?.pv||[]).map((b,i8)=>(<React.Fragment key={i8}>
                  <Hx as="span" s={`height:36px;padding:0 14px;border-radius:11px;background:${b?.bg??""};color:${b?.fg??""};border:1px solid ${b?.bd??""};box-shadow:0 1px 2px rgba(10,16,32,.06),inset 0 1px 0 rgba(255,255,255,.08);display:inline-flex;align-items:center;gap:7px;font:550 13.5px 'Geist';letter-spacing:-.005em;cursor:pointer;white-space:nowrap;transition:filter .15s,transform .1s`} h={"filter:brightness(.96)"} a={"transform:scale(.97)"} onClick={b?.go}>
                    <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${b?.ic??""}) center/contain no-repeat;mask:url(${b?.ic??""}) center/contain no-repeat;`)} />
                    {b?.n}
                  </Hx>
                </React.Fragment>))}
                {(v.fly?.more||[]).map((b,i8)=>(<React.Fragment key={i8}>
                  <Hx as="span" s={`height:36px;padding:0 14px;border-radius:11px;background:${b?.bg??""};color:${b?.fg??""};border:1px solid ${b?.bd??""};box-shadow:0 1px 2px rgba(10,16,32,.06),inset 0 1px 0 rgba(255,255,255,.08);display:inline-flex;align-items:center;gap:7px;font:550 13.5px 'Geist';letter-spacing:-.005em;cursor:pointer;white-space:nowrap;transition:filter .15s,transform .1s`} h={"filter:brightness(.96)"} a={"transform:scale(.97)"} onClick={b?.go}>
                    <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${b?.ic??""}) center/contain no-repeat;mask:url(${b?.ic??""}) center/contain no-repeat;`)} />
                    {b?.n}
                  </Hx>
                </React.Fragment>))}
              </div>
              {' '}
              <div style={css("margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px;border-radius:16px;background:#FAFBFC;box-shadow:inset 0 0 0 1px #F0F2F5")}>
                {(v.fly?.info||[]).map((mt,i8)=>(<React.Fragment key={i8}>
                  <div style={css("min-width:0")}>
                    <p style={css("font:500 11.5px 'Geist';color:#98A2B3")}>
                      {mt?.l}
                    </p>
                    <p style={css("margin-top:2px;font:550 13px 'Geist';overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                      {mt?.v}
                    </p>
                  </div>
                </React.Fragment>))}
              </div>
              {' '}
              <p style={css("margin-top:22px;font:600 13.5px 'Geist'")}>
                What this role can open
              </p>
              {' '}
              <div style={css("margin-top:10px;display:flex;flex-direction:column;gap:12px")}>
                {(v.fly?.areas||[]).map((ar,i8)=>(<React.Fragment key={i8}>
                  <div>
                    <div style={css("display:flex;justify-content:space-between;font:500 12.5px 'Geist'")}>
                      <span>
                        {ar?.n}
                      </span>
                      <span style={css("font-family:'Geist Mono';color:#667085")}>
                        {ar?.v}
                      </span>
                    </div>
                    <div style={css("margin-top:6px;height:6px;border-radius:99px;background:#F2F4F7;overflow:hidden")}>
                      <span style={css(`display:block;height:100%;width:${ar?.w??""};border-radius:99px;background:linear-gradient(90deg,#5EEAD4,#12B8A8)`)} />
                    </div>
                  </div>
                </React.Fragment>))}
              </div>
            </div>
          </>) : null}
          {' '}
          {v.fly?.isParty ? (<>
            <div style={css("flex:1;min-height:0;overflow-y:auto;padding:18px 22px 28px")}>
              <div style={css("display:flex;align-items:center;gap:12px")}>
                <span style={css(`flex:none;width:52px;height:52px;border-radius:15px;background:${v.fly?.avBg??""};display:grid;place-items:center;font:650 17px 'Geist'`)}>
                  {v.fly?.ini}
                </span>
                <div style={css("flex:1;min-width:0")}>
                  <p style={css("font:600 12px 'Geist';color:#667085;text-transform:uppercase;letter-spacing:.06em")}>
                    {v.fly?.typ}
                  </p>
                  <h2 style={css("font:650 21px 'Geist';letter-spacing:-.02em")}>
                    {v.fly?.n}
                  </h2>
                </div>
                <span style={css("width:34px;height:34px;border-radius:9px;display:grid;place-items:center;cursor:pointer;color:#475467")} onClick={v.fly?.close}>
                  <span style={css("flex:none;width:18px;height:18px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;")} />
                </span>
              </div>
              {' '}
              <div style={css("margin-top:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px")}>
                <div style={css("padding:12px;border-radius:12px;background:#F0FAF8")}>
                  <p style={css("font:500 11.5px 'Geist';color:#0B7A6F")}>
                    {v.fly?.outL}
                  </p>
                  <p style={css("margin-top:2px;font:650 16px 'Geist';font-variant-numeric:tabular-nums")}>
                    {v.fly?.out}
                  </p>
                </div>
                <div style={css("padding:12px;border-radius:12px;background:#F5F6F8")}>
                  <p style={css("font:500 11.5px 'Geist';color:#667085")}>
                    This year
                  </p>
                  <p style={css("margin-top:2px;font:650 16px 'Geist';font-variant-numeric:tabular-nums")}>
                    {v.fly?.billed}
                  </p>
                </div>
                <div style={css("padding:12px;border-radius:12px;background:#F5F6F8")}>
                  <p style={css("font:500 11.5px 'Geist';color:#667085")}>
                    Documents
                  </p>
                  <p style={css("margin-top:2px;font:650 16px 'Geist'")}>
                    {v.fly?.cnt}
                  </p>
                </div>
              </div>
              {' '}
              <div style={css("margin-top:14px;display:flex;gap:8px;flex-wrap:wrap")}>
                {(v.fly?.pv||[]).map((b,i8)=>(<React.Fragment key={i8}>
                  <Hx as="span" s={`height:36px;padding:0 14px;border-radius:11px;background:${b?.bg??""};color:${b?.fg??""};border:1px solid ${b?.bd??""};display:inline-flex;align-items:center;gap:7px;font:600 13px 'Geist';cursor:pointer;white-space:nowrap;transition:filter .15s,transform .1s`} h={"filter:brightness(.95)"} a={"transform:scale(.97)"} onClick={b?.go}>
                    <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${b?.ic??""}) center/contain no-repeat;mask:url(${b?.ic??""}) center/contain no-repeat;`)} />
                    {b?.n}
                  </Hx>
                </React.Fragment>))}
                {(v.fly?.more||[]).map((b,i8)=>(<React.Fragment key={i8}>
                  <Hx as="span" s={`height:36px;padding:0 14px;border-radius:11px;background:${b?.bg??""};color:${b?.fg??""};border:1px solid ${b?.bd??""};display:inline-flex;align-items:center;gap:7px;font:600 13px 'Geist';cursor:pointer;white-space:nowrap;transition:filter .15s,transform .1s`} h={"filter:brightness(.95)"} a={"transform:scale(.97)"} onClick={b?.go}>
                    <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${b?.ic??""}) center/contain no-repeat;mask:url(${b?.ic??""}) center/contain no-repeat;`)} />
                    {b?.n}
                  </Hx>
                </React.Fragment>))}
              </div>
              {' '}
              <div style={css("margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:12px")}>
                {(v.fly?.info||[]).map((mt,i8)=>(<React.Fragment key={i8}>
                  <div style={css("min-width:0")}>
                    <p style={css("font:500 11.5px 'Geist';color:#98A2B3")}>
                      {mt?.l}
                    </p>
                    <p style={css("margin-top:2px;font:600 13px 'Geist';overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                      {mt?.v}
                    </p>
                  </div>
                </React.Fragment>))}
              </div>
              {' '}
              <p style={css("margin-top:22px;font:650 13px 'Geist'")}>
                Recent documents
              </p>
              {' '}
              <div style={css("margin-top:8px;border:1px solid #EEF1F5;border-radius:12px;overflow:hidden")}>
                {(v.fly?.docs||[]).map((dc,i8)=>(<React.Fragment key={i8}>
                  <Hx as="div" s={"display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid #F2F4F7;cursor:pointer"} h={"background:#F8FAFB"} onClick={dc?.go}>
                    <div style={css("flex:1;min-width:0")}>
                      <p style={css("font:600 13px 'Geist'")}>
                        {dc?.no}
                      </p>
                      <p style={css("font:500 11.5px 'Geist';color:#98A2B3")}>
                        {dc?.t}
                      </p>
                    </div>
                    <span style={css(`height:22px;padding:0 9px;border-radius:99px;background:${dc?.bg??""};color:${dc?.fg??""};display:grid;place-items:center;font:600 11px 'Geist'`)}>
                      {dc?.st}
                    </span>
                    <span style={css("width:100px;text-align:right;font:650 13px 'Geist';font-variant-numeric:tabular-nums")}>
                      {dc?.a}
                    </span>
                  </Hx>
                </React.Fragment>))}
                {v.fly?.noDocs ? (<>
                  <p style={css("padding:18px;text-align:center;font:500 13px 'Geist';color:#98A2B3")}>
                    No documents yet
                  </p>
                </>) : null}
              </div>
            </div>
          </>) : null}
        </div>
      </div>
    </>
  );
}
