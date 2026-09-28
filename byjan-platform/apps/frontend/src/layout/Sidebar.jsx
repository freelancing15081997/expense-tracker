import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';

export default function Sidebar({ v }) {
  return (
    <aside style={css(`flex:none;width:${v.sbW??""};height:100%;padding:12px 0 12px 12px;transition:width .3s cubic-bezier(.2,.8,.2,1)`)}>
        <div style={css("position:relative;height:100%;display:flex;flex-direction:column;border-radius:24px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(250,252,252,.96));backdrop-filter:blur(14px);border:1px solid rgba(16,24,40,.07);box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 18px 40px -24px rgba(16,24,40,.22)")}>
          <div style={css("position:relative;flex:none;display:flex;align-items:center;gap:11px;padding:18px 16px 14px")}>
            <span style={css("flex:none;width:40px;height:40px;border-radius:13px;background:linear-gradient(150deg,#FFFFFF,#DDF6F2);display:grid;place-items:center;cursor:pointer;box-shadow:inset 0 1px 0 #fff,0 0 0 1px rgba(16,24,40,.06),0 8px 18px -8px rgba(18,184,168,.55)")} onClick={v.goHome}>
              <svg viewBox="0 0 58 51" width="27" height="24" fill="none">
                <rect x="0.5" y="42" width="6.5" height="7.5" rx="1.6" fill="#0B1F3A" />
                <rect x="8.5" y="42" width="6.5" height="7.5" rx="1.6" fill="#0B1F3A" />
                <rect x="16.5" y="2" width="10" height="47.5" rx="2.4" fill="#0B1F3A" />
                <path fill="#0B1F3A" fillRule="evenodd" d="M25 18.5H31.5A15.5 15.5 0 0 1 31.5 49.5H25ZM25 27.5H31.5A6.5 6.5 0 0 1 31.5 40.5H25Z" />
                <path d="M19 42C33.5 41.5 43 34 48.5 17" stroke="#F2FBF9" strokeWidth="11.5" strokeLinecap="round" />
                <path d="M19 42C33.5 41.5 43 34 48.5 17" stroke="#12B8A8" strokeWidth="6.8" strokeLinecap="round" />
                <path d="M40.6 19.6L57 17.4L50.6 2.4Z" fill="#12B8A8" stroke="#F2FBF9" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
            {' '}
            {v.sbExp ? (<>
              <div style={css("flex:1;min-width:0")}>
                <p style={css("font:700 20px/1 'Geist';letter-spacing:-.045em;color:#0B1F3A")}>
                  byjan
                </p>
                <p style={css("margin-top:4px;font:600 10.5px 'Geist';letter-spacing:.14em;color:#0FA898")}>
                  {v.wsLbl}
                </p>
              </div>
            </>) : null}
            {' '}
            {v.sbExp ? (<>
              <Hx as="span" s={"flex:none;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:#98A2B3;cursor:pointer"} h={"background:#F2F4F7;color:#344054"} onClick={v.toggleSb}>
                <span style={css("flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/sidebar-simple.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/sidebar-simple.svg) center/contain no-repeat;")} />
              </Hx>
            </>) : null}
          </div>
          {' '}
          {v.sbCol ? (<>
            <div style={css("position:relative;flex:none;display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 0 6px")}>
              <Hx as="span" s={"width:40px;height:32px;border-radius:10px;background:#F4F6F8;display:grid;place-items:center;color:#475467;cursor:pointer;box-shadow:inset 0 1px 2px rgba(16,24,40,.05)"} h={"background:#E6FAF6;color:#0B6B61"} onClick={v.toggleSb} title="Open menu">
                <span style={css("display:grid;transform:scaleX(-1)")}>
                  <span style={css("width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/sidebar-simple.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/sidebar-simple.svg) center/contain no-repeat")} />
                </span>
              </Hx>
              <Hx as="span" s={"width:40px;height:32px;border-radius:10px;display:grid;place-items:center;color:#98A2B3;cursor:pointer"} h={"background:#F4F6F8"} onClick={v.openCmd} title="Search">
                <span style={css("width:16px;height:16px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat")} />
              </Hx>
            </div>
          </>) : null}
          {' '}
          {v.sbExp ? (<>
            <div style={css("position:relative;flex:none;padding:0 12px")}>
              <Hx as="div" s={"display:flex;align-items:center;gap:10px;padding:10px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:16px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);cursor:pointer;transition:transform .15s"} h={"transform:translateY(-1px)"} onClick={v.toggleWs}>
                <span style={css("flex:none;width:34px;height:34px;border-radius:11px;background:linear-gradient(150deg,#5EEAD4,#12B8A8);color:#fff;display:grid;place-items:center;font:700 12px 'Geist';box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 6px 12px -6px rgba(18,184,168,.8)")}>
                  {v.wsIni}
                </span>
                <div style={css("flex:1;min-width:0")}>
                  <p style={css("font:600 13px 'Geist';letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                    {v.wsCo}
                  </p>
                  <p style={css("font:500 10.5px 'Geist Mono';color:#98A2B3")}>
                    {v.wsSub}
                  </p>
                </div>
                <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
              </Hx>
              {' '}
              <div style={css("margin-top:10px;display:flex;align-items:center;gap:9px;height:38px;padding:0 10px 0 12px;border-radius:12px;background:#F4F6F8;box-shadow:inset 0 1px 2px rgba(16,24,40,.05);color:#98A2B3;cursor:text")} onClick={v.openCmd}>
                <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;")} />
                <span style={css("flex:1;font:500 13px 'Geist'")}>
                  Jump to…
                </span>
                <span style={css("height:20px;padding:0 6px;border-radius:6px;background:#fff;box-shadow:0 1px 1px rgba(16,24,40,.08);display:grid;place-items:center;font:500 10.5px 'Geist Mono';color:#475467")}>
                  ⌘K
                </span>
              </div>
            </div>
          </>) : null}
          {' '}
          <nav style={css("position:relative;flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;padding:14px 12px 12px;display:flex;flex-direction:column")}>
            {v.sbExp ? (<>
              <p style={css("padding:0 12px;font:600 10.5px 'Geist';letter-spacing:.12em;color:#98A2B3")}>
                PINNED
              </p>
            </>) : null}
            {' '}
            <div style={css("margin-top:6px;display:flex;flex-direction:column;gap:2px")}>
              {(v.favs||[]).map((f,i7)=>(<React.Fragment key={i7}>
                <Hx as="div" s={`display:flex;align-items:center;gap:11px;height:38px;padding:0 10px;border-radius:12px;background:${f?.bg??""};box-shadow:${f?.bd??""};color:${f?.fg??""};cursor:pointer;transition:background .15s`} h={"background:#F4F6F8"} onClick={f?.go} onMouseEnter={f?.hover} onMouseLeave={v.sbLeave}>
                  <span style={css(`width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:${f?.icBg??""};color:${f?.icFg??""};box-shadow:${f?.icSh??""}`)}>
                    <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${f?.ic??""}) center/contain no-repeat;mask:url(${f?.ic??""}) center/contain no-repeat;`)} />
                  </span>
                  {v.sbExp ? (<>
                    <span style={css("font:550 13.5px 'Geist';letter-spacing:-.005em;white-space:nowrap")}>
                      {f?.n}
                    </span>
                  </>) : null}
                </Hx>
              </React.Fragment>))}
            </div>
            {' '}
            <div style={css("margin:14px 12px 12px;height:1px;background:linear-gradient(90deg,#EAECF0,rgba(234,236,240,0))")} />
            {' '}
            {v.sbExp ? (<>
              <p style={css("padding:0 12px;font:600 10.5px 'Geist';letter-spacing:.12em;color:#98A2B3")}>
                WORKSPACE
              </p>
            </>) : null}
            {' '}
            <div style={css("margin-top:6px")}>
              {(v.nav||[]).map((g,i7)=>(<React.Fragment key={i7}>
                <div style={css("margin-bottom:2px")}>
                  <Hx as="div" s={`display:flex;align-items:center;gap:11px;height:38px;padding:0 10px;border-radius:12px;cursor:pointer;color:${g?.fg??""};transition:background .15s`} h={"background:#F4F6F8"} onClick={g?.toggle} onMouseEnter={g?.hover} onMouseLeave={v.sbLeave}>
                    <span style={css(`width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:${g?.icBg??""};color:${g?.icFg??""};box-shadow:${g?.icSh??""}`)}>
                      <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${g?.ic??""}) center/contain no-repeat;mask:url(${g?.ic??""}) center/contain no-repeat;`)} />
                    </span>
                    {v.sbExp ? (<>
                      <span style={css("flex:1;font:600 13.5px 'Geist';letter-spacing:-.005em;white-space:nowrap")}>
                        {g?.n}
                      </span>
                    </>) : null}
                    {v.sbExp ? (<>
                      <span style={css(`display:grid;transform:${g?.rot??""};transition:transform .25s;color:#98A2B3`)}>
                        <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-down.svg) center/contain no-repeat;")} />
                      </span>
                    </>) : null}
                  </Hx>
                  {' '}
                  {g?.open ? (<>
                    {v.sbExp ? (<>
                      <div style={css("position:relative;margin:2px 0 8px 22px;padding-left:12px;display:flex;flex-direction:column;gap:1px;animation:fade .25s ease both")}>
                        <span style={css("position:absolute;left:0;top:4px;bottom:4px;width:1.5px;border-radius:2px;background:#EEF0F3")} />
                        {(g?.items||[]).map((it,i12)=>(<React.Fragment key={i12}>
                          <Hx as="div" s={`position:relative;display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border-radius:10px;background:${it?.bg??""};box-shadow:${it?.sh??""};color:${it?.fg??""};font:${it?.fw??""} 13px 'Geist';letter-spacing:-.005em;cursor:pointer;transition:background .15s,color .15s`} h={"background:#F4F6F8;color:#101828"} onClick={it?.go}>
                            <span style={css(`position:absolute;left:-12.5px;top:9px;bottom:9px;width:2px;border-radius:2px;background:${it?.bar??""}`)} />
                            <span style={css(`display:grid;color:${it?.icFg??""}`)}>
                              <span style={css(`flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(${it?.ic??""}) center/contain no-repeat;mask:url(${it?.ic??""}) center/contain no-repeat;`)} />
                            </span>
                            <span style={css("flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                              {it?.n}
                            </span>
                            {it?.hasB ? (<>
                              <span style={css("min-width:20px;height:18px;padding:0 6px;border-radius:6px;background:#F2F4F7;color:#344054;display:grid;place-items:center;font:600 10.5px 'Geist Mono'")}>
                                {it?.b}
                              </span>
                            </>) : null}
                          </Hx>
                        </React.Fragment>))}
                      </div>
                    </>) : null}
                  </>) : null}
                </div>
              </React.Fragment>))}
            </div>
          </nav>
          {' '}
          {v.sbExp ? (<>
            <div style={css("position:relative;flex:none;margin:0 12px;padding:14px;border-radius:18px;overflow:hidden;background:#FAFBFC;border:1px solid rgba(16,24,40,.07);box-shadow:inset 0 1px 0 #fff")}>
              <span style={css("position:absolute;right:-30px;top:-40px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.9),transparent 70%)")} />
              <div style={css("position:relative;display:flex;align-items:center;justify-content:space-between")}>
                <p style={css("font:500 11.5px 'Geist';color:#667085")}>
                  {v.sbc?.l}
                </p>
                <span style={css("display:flex;align-items:center;gap:4px;font:600 10.5px 'Geist Mono';color:#0FA898")}>
                  <span style={css("width:6px;height:6px;border-radius:50%;background:#12B8A8;animation:glow 1.6s ease-in-out infinite")} />
                  LIVE
                </span>
              </div>
              <p style={css("position:relative;margin-top:4px;font:600 20px 'Geist Mono';letter-spacing:-.03em;color:#0B1F3A")}>
                {v.sbc?.v}
              </p>
              <svg style={css("position:relative;display:block;width:100%;height:30px;margin-top:6px")} viewBox="0 0 120 36" preserveAspectRatio="none">
                <path d={v.sbSp?.a} fill="rgba(18,184,168,.16)" />
                <path d={v.sbSp?.d} fill="none" stroke="#12B8A8" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          </>) : null}
          {' '}
          <div style={css("position:relative;flex:none;display:flex;align-items:center;gap:10px;padding:12px 16px 16px")}>
            <span style={css("position:relative;flex:none;width:36px;height:36px;border-radius:12px;background:linear-gradient(150deg,#FFE9DD,#FFD0B8);color:#7A2E0C;display:grid;place-items:center;font:700 12px 'Geist';box-shadow:inset 0 1px 0 rgba(255,255,255,.7)")}>
              {v.me?.ini}
              <span style={css("position:absolute;right:-2px;bottom:-2px;width:10px;height:10px;border-radius:50%;background:#12B76A;box-shadow:0 0 0 2px #fff")} />
            </span>
            {v.sbExp ? (<>
              <div style={css("flex:1;min-width:0")}>
                <p style={css("font:600 13px 'Geist'")}>
                  {v.me?.n}
                </p>
                <p style={css("font:500 11px 'Geist';color:#98A2B3")}>
                  {v.me?.r}
                </p>
              </div>
            </>) : null}
            {v.sbExp ? (<>
              <Hx as="span" s={"width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:#98A2B3;cursor:pointer"} h={"background:#F2F4F7;color:#344054"} onClick={v.goSettings}>
                <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/gear-six-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/gear-six-duotone.svg) center/contain no-repeat;")} />
              </Hx>
            </>) : null}
          </div>
        </div>
      </aside>
  );
}
