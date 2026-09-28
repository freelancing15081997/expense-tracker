import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';

export default function FormDrawer({ v }) {
  return (
    <>
      <div style={css("position:absolute;inset:0;z-index:40;display:flex;justify-content:flex-end;padding:12px")}>
        <div style={css("position:absolute;inset:0;background:rgba(16,24,40,.32);backdrop-filter:blur(3px);animation:fade .2s ease both")} onClick={v.modal?.close} />
        {' '}
        <div style={css("position:relative;width:680px;max-width:100%;height:100%;display:flex;flex-direction:column;background:#F8FAFB;border-radius:24px;overflow:hidden;box-shadow:0 40px 80px -30px rgba(16,24,40,.55),0 0 0 1px rgba(16,24,40,.06);animation:slideIn .25s cubic-bezier(.2,.8,.2,1) both")}>
          <div style={css("flex:none;display:flex;align-items:flex-start;gap:14px;padding:22px 24px 18px;background:#fff;border-bottom:1px solid #EEF0F3")}>
            <span style={css("flex:none;width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(160deg,#fff -40%,#CCFBF1 100%);color:#0B7A6F;box-shadow:inset 0 1px 0 #fff,0 8px 16px -8px #0B7A6F")}>
              <span style={css("flex:none;width:20px;height:20px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/file-plus-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/file-plus-duotone.svg) center/contain no-repeat;")} />
            </span>
            <div style={css("flex:1;min-width:0")}>
              <h3 style={css("font:650 19px 'Geist';letter-spacing:-.02em")}>
                {v.modal?.title}
              </h3>
              <p style={css("margin-top:3px;font:400 13px/1.5 'Geist';color:#667085")}>
                {v.modal?.sub}
              </p>
            </div>
            <Hx as="span" s={"width:36px;height:36px;border-radius:10px;display:grid;place-items:center;cursor:pointer;color:#475467"} h={"background:#F2F4F7"} onClick={v.modal?.close}>
              <span style={css("flex:none;width:18px;height:18px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;")} />
            </Hx>
          </div>
          {' '}
          <div style={css("flex:1;min-height:0;overflow-y:auto;padding:18px 20px 24px;display:flex;flex-direction:column;gap:14px")}>
            {(v.modal?.secs||[]).map((sc,i6)=>(<React.Fragment key={i6}>
              <section style={css("padding:18px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);border-radius:18px")}>
                <div style={css("display:flex;align-items:center;gap:10px;margin-bottom:14px")}>
                  <span style={css("width:28px;height:28px;border-radius:9px;background:#F0FDFA;color:#0B7A6F;display:grid;place-items:center")}>
                    <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${sc?.ic??""}) center/contain no-repeat;mask:url(${sc?.ic??""}) center/contain no-repeat;`)} />
                  </span>
                  <p style={css("font:600 14px 'Geist';letter-spacing:-.01em")}>
                    {sc?.t}
                  </p>
                </div>
                <div style={css("display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 12px")}>
                  {(sc?.fields||[]).map((fl,i9)=>(<React.Fragment key={i9}>
                    <div style={css(`grid-column:${fl?.span??""};min-width:0`)}>
                      {fl?.isTg ? (<>
                        <div style={css("display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:#FAFBFC;box-shadow:inset 0 0 0 1px #F0F2F5")}>
                          <div style={css("flex:1;min-width:0")}>
                            <p style={css("font:550 13px 'Geist'")}>
                              {fl?.l}
                            </p>
                            {fl?.hasHelp ? (<>
                              <p style={css("font:400 12px 'Geist';color:#667085")}>
                                {fl?.help}
                              </p>
                            </>) : null}
                          </div>
                          <span style={css(`flex:none;width:38px;height:22px;border-radius:99px;background:${fl?.tg?.bg??""};padding:2px;display:flex;justify-content:${fl?.tg?.j??""};cursor:pointer;transition:background .2s`)} onClick={fl?.tg?.go}>
                            <span style={css("width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(10,16,32,.25)")} />
                          </span>
                        </div>
                      </>) : null}
                      {' '}
                      {fl?.isTg ? (<>
                        
                      </>) : null}
                      {' '}
                      {fl?.isText ? (<>
                        <div>
                          <p style={css("font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                            {fl?.l}
                          </p>
                          <div style={css("display:flex;align-items:center;height:42px;border-radius:12px;border:1px solid #E4E7EC;background:#fff;box-shadow:0 1px 2px rgba(16,24,40,.04);overflow:hidden")}>
                            {fl?.hasPre ? (<>
                              <span style={css("flex:none;height:100%;padding:0 12px;display:grid;place-items:center;background:#F8FAFB;border-right:1px solid #EEF0F3;font:600 13px 'Geist Mono';color:#667085")}>
                                {fl?.pre}
                              </span>
                            </>) : null}
                            <input style={css(`flex:1;min-width:0;height:100%;padding:0 12px;border:0;background:transparent;font:${fl?.ff??""};text-align:${fl?.ta??""};color:#0A1020;box-shadow:none !important`)} value={fl?.v} onChange={fl?.on} placeholder={fl?.ph} inputMode={fl?.im} />
                          </div>
                          {fl?.hasHelp ? (<>
                            <p style={css("margin-top:5px;font:400 11.5px 'Geist';color:#98A2B3")}>
                              {fl?.help}
                            </p>
                          </>) : null}
                        </div>
                      </>) : null}
                      {' '}
                      {fl?.isArea ? (<>
                        <div>
                          <p style={css("font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                            {fl?.l}
                          </p>
                          <textarea style={css("width:100%;min-height:80px;padding:10px 12px;border-radius:12px;border:1px solid #E4E7EC;background:#fff;font:400 13.5px/1.5 'Geist';color:#0A1020;resize:vertical")} value={fl?.v} onChange={fl?.on} placeholder={fl?.ph} />
                        </div>
                      </>) : null}
                      {' '}
                      {fl?.isDD ? (<>
                        <div>
                          <p style={css("font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                            {fl?.l}
                          </p>
                          <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${fl?.dd?.bd??""};background:#fff;box-shadow:${fl?.dd?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%`} h={"border-color:#99E6DA"} onClick={fl?.dd?.open}>
                            {fl?.dd?.hasIc ? (<>
                              <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${fl?.dd?.icBg??""};color:${fl?.dd?.icFg??""};display:grid;place-items:center`)}>
                                <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${fl?.dd?.ic??""}) center/contain no-repeat;mask:url(${fl?.dd?.ic??""}) center/contain no-repeat;`)} />
                              </span>
                            </>) : null}
                            <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${fl?.dd?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                              {fl?.dd?.label}
                            </span>
                            <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                          </Hx>
                          {fl?.hasHelp ? (<>
                            <p style={css("margin-top:5px;font:400 11.5px 'Geist';color:#98A2B3")}>
                              {fl?.help}
                            </p>
                          </>) : null}
                        </div>
                      </>) : null}
                      {' '}
                      {fl?.isSeg ? (<>
                        <div>
                          <p style={css("font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                            {fl?.l}
                          </p>
                          <div style={css("display:flex;flex-wrap:wrap;gap:3px;padding:3px;border-radius:12px;background:#EEF0F3")}>
                            {(fl?.seg||[]).map((sg,i14)=>(<React.Fragment key={i14}>
                              <span style={css(`flex:1 1 auto;height:36px;padding:0 12px;border-radius:9px;background:${sg?.bg??""};color:${sg?.fg??""};box-shadow:${sg?.sh??""};display:flex;align-items:center;justify-content:center;gap:7px;font:550 12.5px 'Geist';cursor:pointer;white-space:nowrap;transition:all .15s`)} onClick={sg?.go}>
                                {sg?.hasIc ? (<>
                                  <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${sg?.ic??""}) center/contain no-repeat;mask:url(${sg?.ic??""}) center/contain no-repeat;`)} />
                                </>) : null}
                                {sg?.n}
                              </span>
                            </React.Fragment>))}
                          </div>
                        </div>
                      </>) : null}
                      {' '}
                      {fl?.isChips ? (<>
                        <div>
                          <p style={css("font:550 12.5px 'Geist';color:#344054;margin-bottom:6px")}>
                            {fl?.l}
                          </p>
                          <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
                            {(fl?.chips||[]).map((cp,i14)=>(<React.Fragment key={i14}>
                              <span style={css(`height:32px;padding:0 11px;border-radius:99px;background:${cp?.bg??""};color:${cp?.fg??""};border:1px solid ${cp?.bd??""};display:flex;align-items:center;gap:6px;font:550 12.5px 'Geist';cursor:pointer`)} onClick={cp?.go}>
                                <span style={css(`flex:none;width:13px;height:13px;background:currentColor;-webkit-mask:url(${cp?.ic??""}) center/contain no-repeat;mask:url(${cp?.ic??""}) center/contain no-repeat;`)} />
                                {cp?.n}
                              </span>
                            </React.Fragment>))}
                          </div>
                        </div>
                      </>) : null}
                    </div>
                  </React.Fragment>))}
                </div>
              </section>
            </React.Fragment>))}
          </div>
          {' '}
          <div style={css("flex:none;display:flex;align-items:center;gap:10px;padding:14px 20px;background:#fff;border-top:1px solid #EEF0F3")}>
            {v.modal?.hasErr ? (<>
              <p style={css("flex:1;display:flex;align-items:center;gap:8px;font:550 13px 'Geist';color:#B42318")}>
                <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/warning-circle-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/warning-circle-duotone.svg) center/contain no-repeat;")} />
                {v.modal?.err}
              </p>
            </>) : null}
            <span style={css("flex:1")} />
            <Hx as="span" s={"height:42px;padding:0 16px;border-radius:11px;display:grid;place-items:center;font:550 13.5px 'Geist';color:#475467;cursor:pointer"} h={"background:#F2F4F7"} onClick={v.modal?.close}>
              Cancel
            </Hx>
            <span style={css(`height:42px;padding:0 20px;border-radius:11px;background:${v.modal?.okBg??""};color:#fff;display:flex;align-items:center;gap:8px;font:600 13.5px 'Geist';cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 10px 20px -10px rgba(15,168,152,.9)`)} onClick={v.modal?.run}>
              <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;")} />
              {v.modal?.ok}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
