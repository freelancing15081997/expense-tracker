import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';

export default function DocEditor({ v }) {
  return (
    <>
      <div style={css("position:absolute;inset:0;z-index:27;background:radial-gradient(900px 400px at 80% -10%,rgba(45,212,191,.09),transparent 60%),#F5F6F8;display:flex;flex-direction:column;animation:fade .2s ease both")}>
        <div style={css("flex:none;height:72px;display:flex;align-items:center;gap:14px;padding:0 28px;background:rgba(255,255,255,.88);backdrop-filter:blur(12px);border-bottom:1px solid #EAECF0")}>
          <Hx as="span" s={"width:38px;height:38px;border-radius:11px;border:1px solid #E4E7EC;background:#fff;display:grid;place-items:center;cursor:pointer;color:#344054;flex:none"} h={"background:#F5F6F8"} onClick={v.ed?.cancel}>
            <span style={css("flex:none;width:17px;height:17px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;")} />
          </Hx>
          <div style={css("flex:1 1 auto;min-width:0;overflow:hidden")}>
            <div style={css("display:flex;align-items:center;gap:8px")}>
              <p style={css("font:650 18px 'Geist';letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                {v.ed?.title}
              </p>
              <span style={css("height:22px;padding:0 8px;border-radius:7px;background:#F2F4F7;color:#475467;display:grid;place-items:center;font:600 11px 'Geist'")}>
                Draft
              </span>
            </div>
            <p style={css("margin-top:2px;display:flex;align-items:center;gap:6px;font:500 12px 'Geist';color:#98A2B3")}>
              <span style={css("font-family:'Geist Mono';color:#475467;white-space:nowrap")}>
                {v.ed?.no}
              </span>
              {"· "}
              <span style={css("width:6px;height:6px;border-radius:50%;background:#12B76A")} />
              Saved just now
            </p>
          </div>
          {' '}
          <div style={css("flex:none;margin-left:auto;display:flex;align-items:center;gap:8px")}>
            <Hx as="span" s={"height:40px;padding:0 14px;border-radius:11px;display:flex;align-items:center;gap:7px;font:550 13px 'Geist';color:#344054;cursor:pointer;white-space:nowrap"} h={"background:#F2F4F7"} onClick={v.ed?.preview}>
              <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/eye-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/eye-duotone.svg) center/contain no-repeat;")} />
              Preview
            </Hx>
            <span style={css("height:40px;padding:0 16px;border-radius:11px;background:#fff;border:1px solid #E4E7EC;box-shadow:0 1px 2px rgba(16,24,40,.05);display:grid;place-items:center;font:550 13px 'Geist';cursor:pointer;white-space:nowrap")} onClick={v.ed?.draft}>
              Save draft
            </span>
            <Hx as="span" s={"height:40px;padding:0 18px;border-radius:11px;background:linear-gradient(180deg,#22C7B5,#0FA898);color:#fff;display:flex;align-items:center;gap:8px;font:600 13.5px 'Geist';cursor:pointer;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 10px 20px -10px rgba(15,168,152,.9)"} h={"filter:brightness(1.05)"} onClick={v.ed?.post}>
              <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/paper-plane-tilt-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/paper-plane-tilt-duotone.svg) center/contain no-repeat;")} />
              {v.ed?.postL}
            </Hx>
          </div>
        </div>
        {' '}
        <div style={css("flex:1;min-height:0;overflow-y:auto")}>
          <div style={css("max-width:1360px;margin:0 auto;padding:24px 28px 48px;display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start")}>
            <div style={css("flex:1 1 680px;min-width:0;display:flex;flex-direction:column;gap:16px")}>
              {v.ed?.hasErr ? (<>
                <div style={css("display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:14px;background:#FEF3F2;border:1px solid #FECDCA;color:#912018;font:550 13.5px 'Geist';animation:rise .2s ease both")}>
                  <span style={css("flex:none;width:17px;height:17px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/warning-circle-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/warning-circle-duotone.svg) center/contain no-repeat;")} />
                  {v.ed?.err}
                </div>
              </>) : null}
              {' '}
              <section style={css("padding:22px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16)")}>
                <div style={css("display:flex;align-items:center;gap:12px;margin-bottom:16px")}>
                  <span style={css("width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(160deg,#fff -40%,#CCFBF1 100%);color:#0B7A6F;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 4px 10px -5px #0B7A6F")}>
                    <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/user-circle-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/user-circle-duotone.svg) center/contain no-repeat;")} />
                  </span>
                  <div style={css("flex:1;min-width:0")}>
                    <p style={css("font:600 15px 'Geist';letter-spacing:-.015em")}>
                      {v.ed?.partyL}{" and details"}
                    </p>
                    <p style={css("font:400 12px 'Geist';color:#667085")}>
                      Who it’s for, dates and where it’s billed from
                    </p>
                  </div>
                </div>
                {' '}
                <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px 14px")}>
                  {v.ed?.hasParty ? (<>
                    <div style={css("grid-column:1 / -1")}>
                      <div style={css("display:flex;justify-content:space-between")}>
                        <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                          {v.ed?.partyL}
                          <span style={css("color:#F04438")}>
                            *
                          </span>
                        </p>
                        <span style={css("display:flex;align-items:center;gap:4px;font:550 12.5px 'Geist';color:#0B7A6F;cursor:pointer")} onClick={v.ed?.addParty}>
                          <span style={css("flex:none;width:13px;height:13px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/plus.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/plus.svg) center/contain no-repeat;")} />
                          {"New "}{v.ed?.partyL}
                        </span>
                      </div>
                      <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${v.ed?.dParty?.bd??""};background:#fff;box-shadow:${v.ed?.dParty?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%;height:46px`} h={"border-color:#99E6DA"} onClick={v.ed?.dParty?.open}>
                        {v.ed?.dParty?.hasIc ? (<>
                          <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${v.ed?.dParty?.icBg??""};color:${v.ed?.dParty?.icFg??""};display:grid;place-items:center`)}>
                            <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${v.ed?.dParty?.ic??""}) center/contain no-repeat;mask:url(${v.ed?.dParty?.ic??""}) center/contain no-repeat;`)} />
                          </span>
                        </>) : null}
                        <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${v.ed?.dParty?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                          {v.ed?.dParty?.label}
                        </span>
                        <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                      </Hx>
                      {' '}
                      {v.ed?.hasP ? (<>
                        <div style={css("margin-top:10px;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:#FAFBFC;box-shadow:inset 0 0 0 1px #F0F2F5;animation:fade .2s ease both")}>
                          <span style={css(`flex:none;width:38px;height:38px;border-radius:12px;background:${v.ed?.snap?.bg??""};display:grid;place-items:center;font:650 12.5px 'Geist'`)}>
                            {v.ed?.snap?.ini}
                          </span>
                          <div style={css("flex:1;min-width:0")}>
                            <p style={css("font:550 13.5px 'Geist'")}>
                              {v.ed?.snap?.city}
                            </p>
                            <p style={css("font:500 12px 'Geist Mono';color:#667085")}>
                              {v.ed?.snap?.g}{" · "}
                              <span style={css("font-family:'Geist'")}>
                                {v.ed?.snap?.e}
                              </span>
                            </p>
                          </div>
                          <span style={css(`flex:none;height:24px;padding:0 9px;border-radius:8px;background:${v.ed?.posBg??""};color:${v.ed?.posFg??""};display:grid;place-items:center;font:600 11.5px 'Geist'`)}>
                            {v.ed?.pos}
                          </span>
                        </div>
                      </>) : null}
                    </div>
                  </>) : null}
                  {' '}
                  <div>
                    <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                      {v.ed?.typ}{" number"}
                    </p>
                    <div style={css("display:flex;align-items:center;height:42px;padding:0 12px;border-radius:12px;background:#F8FAFB;border:1px solid #E4E7EC;font:600 13.5px 'Geist Mono';color:#0A1020;white-space:nowrap;overflow:hidden")}>
                      {v.ed?.no}
                      <span style={css("margin-left:auto;font:500 11px 'Geist';color:#98A2B3")}>
                        Auto
                      </span>
                    </div>
                  </div>
                  {' '}
                  <div>
                    <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                      Date
                      <span style={css("color:#F04438")}>
                        *
                      </span>
                    </p>
                    <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${v.ed?.dDt?.bd??""};background:#fff;box-shadow:${v.ed?.dDt?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%`} h={"border-color:#99E6DA"} onClick={v.ed?.dDt?.open}>
                      {v.ed?.dDt?.hasIc ? (<>
                        <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${v.ed?.dDt?.icBg??""};color:${v.ed?.dDt?.icFg??""};display:grid;place-items:center`)}>
                          <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${v.ed?.dDt?.ic??""}) center/contain no-repeat;mask:url(${v.ed?.dDt?.ic??""}) center/contain no-repeat;`)} />
                        </span>
                      </>) : null}
                      <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${v.ed?.dDt?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                        {v.ed?.dDt?.label}
                      </span>
                      <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                    </Hx>
                  </div>
                  {' '}
                  {v.ed?.hasTerms ? (<>
                    <div>
                      <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                        Payment terms
                      </p>
                      <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${v.ed?.dTerms?.bd??""};background:#fff;box-shadow:${v.ed?.dTerms?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%`} h={"border-color:#99E6DA"} onClick={v.ed?.dTerms?.open}>
                        {v.ed?.dTerms?.hasIc ? (<>
                          <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${v.ed?.dTerms?.icBg??""};color:${v.ed?.dTerms?.icFg??""};display:grid;place-items:center`)}>
                            <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${v.ed?.dTerms?.ic??""}) center/contain no-repeat;mask:url(${v.ed?.dTerms?.ic??""}) center/contain no-repeat;`)} />
                          </span>
                        </>) : null}
                        <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${v.ed?.dTerms?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                          {v.ed?.dTerms?.label}
                        </span>
                        <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                      </Hx>
                      <p style={css("margin-top:5px;font:500 11.5px 'Geist';color:#0B7A6F")}>
                        {v.ed?.dueL}
                      </p>
                    </div>
                  </>) : null}
                  {' '}
                  {v.ed?.hasParty ? (<>
                    <div>
                      <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                        {v.ed?.refL}
                      </p>
                      <input style={css("height:42px;padding:0 12px;border-radius:12px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;box-shadow:0 1px 2px rgba(16,24,40,.04);width:100%")} value={v.ed?.ref} onChange={v.ed?.onRef} placeholder="Optional" />
                    </div>
                  </>) : null}
                  {' '}
                  {v.ed?.notJ ? (<>
                    <div>
                      <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                        Salesperson
                      </p>
                      <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${v.ed?.dSp?.bd??""};background:#fff;box-shadow:${v.ed?.dSp?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%`} h={"border-color:#99E6DA"} onClick={v.ed?.dSp?.open}>
                        {v.ed?.dSp?.hasIc ? (<>
                          <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${v.ed?.dSp?.icBg??""};color:${v.ed?.dSp?.icFg??""};display:grid;place-items:center`)}>
                            <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${v.ed?.dSp?.ic??""}) center/contain no-repeat;mask:url(${v.ed?.dSp?.ic??""}) center/contain no-repeat;`)} />
                          </span>
                        </>) : null}
                        <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${v.ed?.dSp?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                          {v.ed?.dSp?.label}
                        </span>
                        <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                      </Hx>
                    </div>
                  </>) : null}
                  {' '}
                  {v.ed?.notJ ? (<>
                    <div>
                      <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                        Project
                      </p>
                      <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${v.ed?.dProj?.bd??""};background:#fff;box-shadow:${v.ed?.dProj?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%`} h={"border-color:#99E6DA"} onClick={v.ed?.dProj?.open}>
                        {v.ed?.dProj?.hasIc ? (<>
                          <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${v.ed?.dProj?.icBg??""};color:${v.ed?.dProj?.icFg??""};display:grid;place-items:center`)}>
                            <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${v.ed?.dProj?.ic??""}) center/contain no-repeat;mask:url(${v.ed?.dProj?.ic??""}) center/contain no-repeat;`)} />
                          </span>
                        </>) : null}
                        <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${v.ed?.dProj?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                          {v.ed?.dProj?.label}
                        </span>
                        <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                      </Hx>
                    </div>
                  </>) : null}
                  {' '}
                  <div>
                    <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                      Billed from
                    </p>
                    <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${v.ed?.dBr?.bd??""};background:#fff;box-shadow:${v.ed?.dBr?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%`} h={"border-color:#99E6DA"} onClick={v.ed?.dBr?.open}>
                      {v.ed?.dBr?.hasIc ? (<>
                        <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${v.ed?.dBr?.icBg??""};color:${v.ed?.dBr?.icFg??""};display:grid;place-items:center`)}>
                          <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${v.ed?.dBr?.ic??""}) center/contain no-repeat;mask:url(${v.ed?.dBr?.ic??""}) center/contain no-repeat;`)} />
                        </span>
                      </>) : null}
                      <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${v.ed?.dBr?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                        {v.ed?.dBr?.label}
                      </span>
                      <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                    </Hx>
                  </div>
                  {' '}
                  {v.ed?.isJ ? (<>
                    <div style={css("grid-column:1 / -1")}>
                      <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                        Narration
                        <span style={css("color:#F04438")}>
                          *
                        </span>
                      </p>
                      <input style={css("height:42px;padding:0 12px;border-radius:12px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;box-shadow:0 1px 2px rgba(16,24,40,.04);width:100%")} value={v.ed?.nar} onChange={v.ed?.onNar} placeholder="Why is this entry being made?" />
                    </div>
                  </>) : null}
                </div>
              </section>
              {' '}
              <section style={css("background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);overflow:hidden")}>
                <div style={css("display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:18px 22px 14px")}>
                  <div style={css("flex:1;min-width:200px;display:flex;align-items:center;gap:12px")}>
                    <span style={css("width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(160deg,#fff -40%,#E0E7FF 100%);color:#4F46E5;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 4px 10px -5px #4F46E5")}>
                      <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/list-checks-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/list-checks-duotone.svg) center/contain no-repeat;")} />
                    </span>
                    <div>
                      <p style={css("font:600 15px 'Geist';letter-spacing:-.015em")}>
                        Items
                      </p>
                      <p style={css("font:400 12px 'Geist';color:#667085")}>
                        {v.ed?.noLines}{" · prices in ₹ INR"}
                      </p>
                    </div>
                  </div>
                  {' '}
                  {v.ed?.notJ ? (<>
                    <div style={css("display:flex;padding:3px;border-radius:11px;background:#F2F4F7")}>
                      {(v.ed?.tmodes||[]).map((tm,i11)=>(<React.Fragment key={i11}>
                        <span style={css(`height:30px;padding:0 11px;border-radius:8px;background:${tm?.bg??""};color:${tm?.fg??""};box-shadow:${tm?.sh??""};display:grid;place-items:center;font:550 12px 'Geist';cursor:pointer;white-space:nowrap`)} onClick={tm?.go}>
                          {tm?.n}
                        </span>
                      </React.Fragment>))}
                    </div>
                  </>) : null}
                </div>
                {' '}
                <div style={css("overflow-x:auto")}>
                  {v.ed?.notJ ? (<>
                    <div style={css("min-width:860px")}>
                      <div style={css("display:grid;grid-template-columns:24px minmax(220px,1fr) 84px 110px 76px 84px 124px 32px;gap:10px;align-items:center;padding:10px 22px;background:#FAFBFC;border-top:1px solid #F0F2F5;border-bottom:1px solid #F0F2F5;font:550 11.5px 'Geist';color:#667085")}>
                        <span />
                        <span>
                          Item or service
                        </span>
                        <span style={css("text-align:right")}>
                          Qty
                        </span>
                        <span style={css("text-align:right")}>
                          Rate
                        </span>
                        <span style={css("text-align:right")}>
                          Disc %
                        </span>
                        <span>
                          GST
                        </span>
                        <span style={css("text-align:right")}>
                          Amount
                        </span>
                        <span />
                      </div>
                      {' '}
                      {(v.ed?.lines||[]).map((ln,i11)=>(<React.Fragment key={i11}>
                        <Hx as="div" s={"display:grid;grid-template-columns:24px minmax(220px,1fr) 84px 110px 76px 84px 124px 32px;gap:10px;align-items:start;padding:12px 22px;border-bottom:1px solid #F4F5F7;animation:fade .2s ease both"} h={"background:#FCFDFD"}>
                          <span style={css("height:42px;display:grid;place-items:center;color:#D0D5DD;cursor:grab")}>
                            <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/dots-six-vertical.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/dots-six-vertical.svg) center/contain no-repeat;")} />
                          </span>
                          <div style={css("min-width:0;display:flex;flex-direction:column;gap:6px")}>
                            <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${ln?.dItem?.bd??""};background:#fff;box-shadow:${ln?.dItem?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%`} h={"border-color:#99E6DA"} onClick={ln?.dItem?.open}>
                              {ln?.dItem?.hasIc ? (<>
                                <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${ln?.dItem?.icBg??""};color:${ln?.dItem?.icFg??""};display:grid;place-items:center`)}>
                                  <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${ln?.dItem?.ic??""}) center/contain no-repeat;mask:url(${ln?.dItem?.ic??""}) center/contain no-repeat;`)} />
                                </span>
                              </>) : null}
                              <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${ln?.dItem?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                                {ln?.dItem?.label}
                              </span>
                              <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                            </Hx>
                            <input style={css("height:32px;padding:0 10px;border-radius:9px;border:1px dashed #E4E7EC;background:transparent;font:400 12.5px 'Geist';color:#475467")} value={ln?.desc} onChange={ln?.onDesc} placeholder="Add a description (optional)" />
                            <p style={css("font:500 11px 'Geist Mono';color:#98A2B3")}>
                              {ln?.hsn}{" · per "}{ln?.u}
                            </p>
                          </div>
                          <input style={css("height:42px;padding:0 12px;border-radius:12px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;box-shadow:0 1px 2px rgba(16,24,40,.04);width:100%;text-align:right;font-family:'Geist Mono'")} value={ln?.q} onChange={ln?.onQ} placeholder="0" inputMode="decimal" />
                          <input style={css("height:42px;padding:0 12px;border-radius:12px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;box-shadow:0 1px 2px rgba(16,24,40,.04);width:100%;text-align:right;font-family:'Geist Mono'")} value={ln?.r} onChange={ln?.onR} placeholder="0" inputMode="decimal" />
                          <input style={css("height:42px;padding:0 12px;border-radius:12px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;box-shadow:0 1px 2px rgba(16,24,40,.04);width:100%;text-align:right;font-family:'Geist Mono'")} value={ln?.disc} onChange={ln?.onDisc} placeholder="0" inputMode="decimal" />
                          <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${ln?.dG?.bd??""};background:#fff;box-shadow:${ln?.dG?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%`} h={"border-color:#99E6DA"} onClick={ln?.dG?.open}>
                            {ln?.dG?.hasIc ? (<>
                              <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${ln?.dG?.icBg??""};color:${ln?.dG?.icFg??""};display:grid;place-items:center`)}>
                                <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${ln?.dG?.ic??""}) center/contain no-repeat;mask:url(${ln?.dG?.ic??""}) center/contain no-repeat;`)} />
                              </span>
                            </>) : null}
                            <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${ln?.dG?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                              {ln?.dG?.label}
                            </span>
                            <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                          </Hx>
                          <span style={css("height:42px;display:flex;align-items:center;justify-content:flex-end;font:600 13.5px 'Geist Mono';letter-spacing:-.02em")}>
                            {ln?.amt}
                          </span>
                          <Hx as="span" s={`width:32px;height:42px;border-radius:9px;display:grid;place-items:center;color:#98A2B3;cursor:pointer;opacity:${ln?.delOp??""}`} h={"color:#D92D20;background:#FEF3F2"} onClick={ln?.del}>
                            <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/trash-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/trash-duotone.svg) center/contain no-repeat;")} />
                          </Hx>
                        </Hx>
                      </React.Fragment>))}
                    </div>
                  </>) : null}
                  {' '}
                  {v.ed?.isJ ? (<>
                    <div style={css("min-width:620px")}>
                      <div style={css("display:grid;grid-template-columns:28px minmax(200px,1fr) 150px 150px 32px;gap:10px;align-items:center;padding:10px 16px;background:#F8FAFB;border-bottom:1px solid #EEF1F5;font:600 11px 'Geist';letter-spacing:.04em;color:#667085")}>
                        <span>
                          #
                        </span>
                        <span>
                          ACCOUNT
                        </span>
                        <span style={css("text-align:right")}>
                          DEBIT ₹
                        </span>
                        <span style={css("text-align:right")}>
                          CREDIT ₹
                        </span>
                        <span />
                      </div>
                      {' '}
                      {(v.ed?.lines||[]).map((ln,i11)=>(<React.Fragment key={i11}>
                        <div style={css("display:grid;grid-template-columns:28px minmax(200px,1fr) 150px 150px 32px;gap:10px;align-items:center;padding:10px 16px;border-bottom:1px solid #F2F4F7")}>
                          <span style={css("font:600 12px 'Geist';color:#98A2B3")}>
                            {ln?.n}
                          </span>
                          <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${ln?.dAcc?.bd??""};background:#fff;box-shadow:${ln?.dAcc?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%`} h={"border-color:#99E6DA"} onClick={ln?.dAcc?.open}>
                            {ln?.dAcc?.hasIc ? (<>
                              <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${ln?.dAcc?.icBg??""};color:${ln?.dAcc?.icFg??""};display:grid;place-items:center`)}>
                                <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${ln?.dAcc?.ic??""}) center/contain no-repeat;mask:url(${ln?.dAcc?.ic??""}) center/contain no-repeat;`)} />
                              </span>
                            </>) : null}
                            <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${ln?.dAcc?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                              {ln?.dAcc?.label}
                            </span>
                            <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                          </Hx>
                          <input style={css("height:40px;padding:0 12px;border-radius:11px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;width:100%;text-align:right")} value={ln?.dr} onChange={ln?.onDr} placeholder="" inputMode="decimal" />
                          <input style={css("height:40px;padding:0 12px;border-radius:11px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;width:100%;text-align:right")} value={ln?.cr} onChange={ln?.onCr} placeholder="" inputMode="decimal" />
                          <span style={css(`width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:#B42318;cursor:pointer;opacity:${ln?.delOp??""}`)} onClick={ln?.del}>
                            <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/trash-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/trash-duotone.svg) center/contain no-repeat;")} />
                          </span>
                        </div>
                      </React.Fragment>))}
                    </div>
                  </>) : null}
                </div>
                {' '}
                <div style={css("display:flex;align-items:center;gap:10px;padding:14px 22px")}>
                  <Hx as="span" s={"display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px;border-radius:10px;background:#F0FDFA;border:1px dashed #99E6DA;color:#0B6B61;font:550 13px 'Geist';cursor:pointer"} h={"background:#E6FAF6"} onClick={v.ed?.addLine}>
                    <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/plus.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/plus.svg) center/contain no-repeat;")} />
                    Add a line
                  </Hx>
                  <Hx as="span" s={"display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px;border-radius:10px;color:#475467;font:550 13px 'Geist';cursor:pointer"} h={"background:#F2F4F7"} onClick={v.ed?.preview}>
                    <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/upload-simple-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/upload-simple-duotone.svg) center/contain no-repeat;")} />
                    Paste from Excel
                  </Hx>
                </div>
              </section>
              {' '}
              {v.ed?.notJ ? (<>
                <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px")}>
                  <section style={css("padding:22px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16)")}>
                    <div style={css("display:flex;align-items:center;gap:12px;margin-bottom:16px")}>
                      <span style={css("width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(160deg,#fff -40%,#CCFBF1 100%);color:#0B7A6F;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 4px 10px -5px #0B7A6F")}>
                        <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/lucide-static@0.460.0/icons/note-pencil.svg) center/contain no-repeat;mask:url(https://unpkg.com/lucide-static@0.460.0/icons/note-pencil.svg) center/contain no-repeat;")} />
                      </span>
                      <div style={css("flex:1;min-width:0")}>
                        <p style={css("font:600 15px 'Geist';letter-spacing:-.015em")}>
                          Notes and terms
                        </p>
                        <p style={css("font:400 12px 'Geist';color:#667085")}>
                          Printed on the PDF
                        </p>
                      </div>
                    </div>
                    <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                      {"Note to the "}{v.ed?.partyL}
                    </p>
                    <textarea style={css("width:100%;min-height:74px;padding:10px 12px;border-radius:12px;border:1px solid #E4E7EC;font:400 13.5px/1.5 'Geist';color:#0A1020;resize:vertical")} value={v.ed?.notes} onChange={v.ed?.onNotes} placeholder="e.g. Thank you for your business." />
                    {v.ed?.hasTnc ? (<>
                      <div style={css("margin-top:12px")}>
                        <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                          Terms and conditions
                        </p>
                        <textarea style={css("width:100%;min-height:74px;padding:10px 12px;border-radius:12px;border:1px solid #E4E7EC;font:400 13px/1.5 'Geist';color:#475467;resize:vertical")} value={v.ed?.tnc} onChange={v.ed?.onTnc} />
                      </div>
                    </>) : null}
                  </section>
                  {' '}
                  <section style={css("padding:22px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16)")}>
                    <div style={css("display:flex;align-items:center;gap:12px;margin-bottom:16px")}>
                      <span style={css("width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(160deg,#fff -40%,#CCFBF1 100%);color:#0B7A6F;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 4px 10px -5px #0B7A6F")}>
                        <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/paperclip-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/paperclip-duotone.svg) center/contain no-repeat;")} />
                      </span>
                      <div style={css("flex:1;min-width:0")}>
                        <p style={css("font:600 15px 'Geist';letter-spacing:-.015em")}>
                          Attachments
                        </p>
                        <p style={css("font:400 12px 'Geist';color:#667085")}>
                          Purchase orders, challans, photos · up to 10 files
                        </p>
                      </div>
                      <span style={css("font:500 12px 'Geist Mono';color:#98A2B3")}>
                        {v.ed?.filesN}
                      </span>
                    </div>
                    <Hx as="div" s={"padding:20px;border-radius:14px;border:1.5px dashed #C8D0DA;background:linear-gradient(180deg,#FAFBFC,#F5F7F9);text-align:center;cursor:pointer;transition:border-color .15s,background .15s"} h={"border-color:#12B8A8;background:#F0FDFA"} onClick={v.ed?.addFile}>
                      <span style={css("margin:0 auto;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(160deg,#fff -40%,#CCFBF1 100%);color:#0B7A6F;box-shadow:inset 0 1px 0 #fff,0 6px 12px -7px #0B7A6F")}>
                        <span style={css("flex:none;width:20px;height:20px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/cloud-arrow-up-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/cloud-arrow-up-duotone.svg) center/contain no-repeat;")} />
                      </span>
                      <p style={css("margin-top:10px;font:550 13.5px 'Geist'")}>
                        {"Drop files or "}
                        <span style={css("color:#0B7A6F")}>
                          browse
                        </span>
                      </p>
                      <p style={css("margin-top:2px;font:400 12px 'Geist';color:#98A2B3")}>
                        PDF, JPG, PNG, XLSX · 20 MB each
                      </p>
                    </Hx>
                    {' '}
                    {v.ed?.hasFiles ? (<>
                      <div style={css("margin-top:10px;display:flex;flex-direction:column;gap:6px")}>
                        {(v.ed?.files||[]).map((fi,i12)=>(<React.Fragment key={i12}>
                          <div style={css("display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;background:#fff;border:1px solid #EEF0F3;animation:rise .2s ease both")}>
                            <span style={css("width:32px;height:32px;border-radius:9px;background:#FEF3F2;color:#D92D20;display:grid;place-items:center")}>
                              <span style={css(`flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(${fi?.ic??""}) center/contain no-repeat;mask:url(${fi?.ic??""}) center/contain no-repeat;`)} />
                            </span>
                            <div style={css("flex:1;min-width:0")}>
                              <p style={css("font:550 13px 'Geist';white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                                {fi?.n}
                              </p>
                              <p style={css("font:500 11px 'Geist Mono';color:#98A2B3")}>
                                {fi?.sz}{" · uploaded"}
                              </p>
                            </div>
                            <Hx as="span" s={"width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:#98A2B3;cursor:pointer"} h={"background:#FEF3F2;color:#D92D20"} onClick={fi?.del}>
                              <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;")} />
                            </Hx>
                          </div>
                        </React.Fragment>))}
                      </div>
                    </>) : null}
                  </section>
                </div>
              </>) : null}
              {' '}
              {v.ed?.notJ ? (<>
                <section style={css("padding:22px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16)")}>
                  <div style={css("display:flex;align-items:center;gap:12px;margin-bottom:16px")}>
                    <span style={css("width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(160deg,#fff -40%,#CCFBF1 100%);color:#0B7A6F;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 4px 10px -5px #0B7A6F")}>
                      <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/sliders-horizontal-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/sliders-horizontal-duotone.svg) center/contain no-repeat;")} />
                    </span>
                    <div style={css("flex:1;min-width:0")}>
                      <p style={css("font:600 15px 'Geist';letter-spacing:-.015em")}>
                        More options
                      </p>
                      <p style={css("font:400 12px 'Geist';color:#667085")}>
                        Compliance, payment and automation
                      </p>
                    </div>
                  </div>
                  <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px")}>
                    {(v.ed?.opts||[]).map((op,i10)=>(<React.Fragment key={i10}>
                      <div style={css("display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:#FAFBFC;box-shadow:inset 0 0 0 1px #F0F2F5")}>
                        <div style={css("flex:1;min-width:0")}>
                          <p style={css("font:550 13.5px 'Geist'")}>
                            {op?.l}
                          </p>
                          <p style={css("font:400 12px 'Geist';color:#667085")}>
                            {op?.s}
                          </p>
                        </div>
                        <span style={css(`flex:none;width:38px;height:22px;border-radius:99px;background:${op?.bg??""};padding:2px;display:flex;justify-content:${op?.j??""};cursor:pointer;transition:background .2s`)} onClick={op?.go}>
                          <span style={css("width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(10,16,32,.25)")} />
                        </span>
                      </div>
                    </React.Fragment>))}
                  </div>
                  {' '}
                  <div style={css("margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px")}>
                    <div>
                      <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                        TDS / TCS
                      </p>
                      <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${v.ed?.dTds?.bd??""};background:#fff;box-shadow:${v.ed?.dTds?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%`} h={"border-color:#99E6DA"} onClick={v.ed?.dTds?.open}>
                        {v.ed?.dTds?.hasIc ? (<>
                          <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${v.ed?.dTds?.icBg??""};color:${v.ed?.dTds?.icFg??""};display:grid;place-items:center`)}>
                            <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${v.ed?.dTds?.ic??""}) center/contain no-repeat;mask:url(${v.ed?.dTds?.ic??""}) center/contain no-repeat;`)} />
                          </span>
                        </>) : null}
                        <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${v.ed?.dTds?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                          {v.ed?.dTds?.label}
                        </span>
                        <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                      </Hx>
                    </div>
                    <div>
                      <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                        Customer PO date
                      </p>
                      <input style={css("height:42px;padding:0 12px;border-radius:12px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;box-shadow:0 1px 2px rgba(16,24,40,.04);width:100%")} value={v.ed?.cf1} onChange={v.ed?.onCf1} placeholder="e.g. 18 Sep 2026" />
                    </div>
                    <div>
                      <p style={css("display:flex;gap:4px;font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                        Vehicle number
                      </p>
                      <input style={css("height:42px;padding:0 12px;border-radius:12px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;box-shadow:0 1px 2px rgba(16,24,40,.04);width:100%;font-family:'Geist Mono'")} value={v.ed?.cf2} onChange={v.ed?.onCf2} placeholder="e.g. MH04 AB 1234" />
                    </div>
                  </div>
                </section>
              </>) : null}
            </div>
            {' '}
            <aside style={css("flex:1 1 320px;max-width:400px;min-width:0;position:sticky;top:0;display:flex;flex-direction:column;gap:16px")}>
              <section style={css("position:relative;overflow:hidden;padding:22px;border-radius:22px;background:linear-gradient(150deg,#FFFFFF 0%,#F0FDFA 70%,#EEF4FF 100%);border:1px solid rgba(16,24,40,.07);box-shadow:inset 0 1px 0 #fff,0 20px 40px -26px rgba(18,120,110,.5)")}>
                <span style={css("position:absolute;right:-60px;top:-60px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(45,212,191,.2),transparent 70%)")} />
                <p style={css("position:relative;font:550 12px 'Geist';color:#475467")}>
                  {v.ed?.typ}{" total"}
                </p>
                <p style={css("position:relative;margin-top:6px;font:600 34px/1.05 'Geist Mono';letter-spacing:-.05em")}>
                  {v.ed?.big}
                </p>
                <p style={css("position:relative;margin-top:6px;font:500 12px/1.4 'Geist';color:#0B7A6F")}>
                  {v.ed?.inWords}
                </p>
                {' '}
                <div style={css("position:relative;margin-top:16px;padding-top:14px;border-top:1px solid rgba(16,24,40,.06);display:flex;flex-direction:column;gap:9px")}>
                  {(v.ed?.totals||[]).map((tt,i9)=>(<React.Fragment key={i9}>
                    <div style={css(`display:flex;justify-content:space-between;padding-top:${tt?.pt??""};border-top:${tt?.bt??""};font:${tt?.ft??""} 'Geist';color:${tt?.fg??""}`)}>
                      <span>
                        {tt?.l}
                      </span>
                      <span style={css("font-family:'Geist Mono';letter-spacing:-.02em")}>
                        {tt?.v}
                      </span>
                    </div>
                  </React.Fragment>))}
                  {v.ed?.hasTds ? (<>
                    <div style={css("display:flex;justify-content:space-between;font:500 13px 'Geist';color:#B54708")}>
                      <span>
                        TDS
                      </span>
                      <span style={css("font-family:'Geist Mono'")}>
                        {v.ed?.tdsV}
                      </span>
                    </div>
                    <div style={css("display:flex;justify-content:space-between;font:600 14px 'Geist'")}>
                      <span>
                        {v.ed?.recvL}
                      </span>
                      <span style={css("font-family:'Geist Mono'")}>
                        {v.ed?.recv}
                      </span>
                    </div>
                  </>) : null}
                </div>
                {' '}
                {v.ed?.notJ ? (<>
                  <div style={css("position:relative;margin-top:14px;display:flex;align-items:center;gap:10px")}>
                    <span style={css("flex:1;font:550 12.5px 'Geist';color:#344054")}>
                      Discount on total ₹
                    </span>
                    <input style={css("height:42px;padding:0 12px;border-radius:12px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;box-shadow:0 1px 2px rgba(16,24,40,.04);width:120px;text-align:right;font-family:'Geist Mono'")} value={v.ed?.disc} onChange={v.ed?.onDisc} placeholder="0" inputMode="decimal" />
                  </div>
                </>) : null}
                {' '}
                <Hx as="span" s={"position:relative;margin-top:16px;height:48px;border-radius:14px;background:linear-gradient(180deg,#22C7B5,#0FA898);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font:600 14.5px 'Geist';cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 12px 24px -12px rgba(15,168,152,.9)"} h={"filter:brightness(1.05)"} onClick={v.ed?.post}>
                  <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/paper-plane-tilt-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/paper-plane-tilt-duotone.svg) center/contain no-repeat;")} />
                  {v.ed?.postL}
                </Hx>
                <span style={css("position:relative;margin-top:8px;height:42px;border-radius:13px;background:#fff;border:1px solid #E4E7EC;display:grid;place-items:center;font:550 13.5px 'Geist';cursor:pointer")} onClick={v.ed?.draft}>
                  Save as draft
                </span>
              </section>
              {' '}
              {v.ed?.hasP ? (<>
                <section style={css("padding:20px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);animation:rise .3s ease both")}>
                  <p style={css("font:600 14px 'Geist';letter-spacing:-.01em")}>
                    {v.ed?.snap?.n}
                  </p>
                  <p style={css("font:400 12px 'Geist';color:#667085")}>
                    Account snapshot
                  </p>
                  <div style={css("margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px")}>
                    <div style={css("padding:10px 12px;border-radius:12px;background:#FAFBFC;box-shadow:inset 0 0 0 1px #F0F2F5")}>
                      <p style={css("font:500 11.5px 'Geist';color:#667085")}>
                        Outstanding
                      </p>
                      <p style={css("margin-top:2px;font:600 15px 'Geist Mono';letter-spacing:-.03em")}>
                        {v.ed?.snap?.out}
                      </p>
                    </div>
                    <div style={css("padding:10px 12px;border-radius:12px;background:#FAFBFC;box-shadow:inset 0 0 0 1px #F0F2F5")}>
                      <p style={css("font:500 11.5px 'Geist';color:#667085")}>
                        Overdue
                      </p>
                      <p style={css("margin-top:2px;font:600 15px 'Geist Mono';letter-spacing:-.03em;color:#B42318")}>
                        {v.ed?.snap?.od}
                      </p>
                    </div>
                  </div>
                  <div style={css("margin-top:12px")}>
                    <div style={css("display:flex;justify-content:space-between;font:500 12px 'Geist';color:#667085")}>
                      <span>
                        Credit limit used
                      </span>
                      <span style={css("font-family:'Geist Mono'")}>
                        {"of "}{v.ed?.snap?.lim}
                      </span>
                    </div>
                    <div style={css("margin-top:6px;height:7px;border-radius:99px;background:#F2F4F7;overflow:hidden")}>
                      <span style={css(`display:block;height:100%;width:${v.ed?.snap?.w??""};border-radius:99px;background:${v.ed?.snap?.wc??""}`)} />
                    </div>
                  </div>
                  <div style={css("margin-top:12px;display:flex;flex-direction:column;gap:6px;font:500 12.5px 'Geist';color:#475467")}>
                    <p style={css("display:flex;justify-content:space-between")}>
                      <span>
                        Usually pays in
                      </span>
                      <b style={css("font-weight:600;color:#0A1020")}>
                        {v.ed?.snap?.days}
                      </b>
                    </p>
                    <p style={css("display:flex;justify-content:space-between")}>
                      <span>
                        Last payment
                      </span>
                      <b style={css("font-weight:600;color:#0A1020")}>
                        {v.ed?.snap?.last}
                      </b>
                    </p>
                  </div>
                </section>
              </>) : null}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
