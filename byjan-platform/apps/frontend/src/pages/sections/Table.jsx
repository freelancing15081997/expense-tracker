import React from 'react';
import { css } from '../../ui/css.js';
import Hx from '../../ui/Hx.jsx';

export default function Table({ v }) {
  return (
    <>
      <div style={css("margin-top:20px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);overflow:hidden;animation:rise .4s .05s ease both")}>
        <div style={css("display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 16px")}>
          {v.pg?.hasTabs ? (<>
            <div style={css("flex:1 1 420px;min-width:0")}>
              <div style={css("display:inline-flex;flex-wrap:wrap;gap:2px;padding:3px;border-radius:12px;background:#F2F4F7;max-width:100%")}>
                {(v.pg?.tabs||[]).map((t,i8)=>(<React.Fragment key={i8}>
                  <span style={css(`flex:none;height:32px;padding:0 12px;border-radius:9px;display:flex;align-items:center;gap:7px;font:550 12.5px 'Geist';cursor:pointer;white-space:nowrap;background:${t?.bg??""};color:${t?.fg??""};box-shadow:${t?.sh??""};transition:all .15s`)} onClick={t?.go}>
                    {t?.n}
                    {t?.hasCnt ? (<>
                      <span style={css(`min-width:20px;height:18px;padding:0 5px;border-radius:6px;background:${t?.cBg??""};color:${t?.cFg??""};display:grid;place-items:center;font:600 10.5px 'Geist Mono'`)}>
                        {t?.cnt}
                      </span>
                    </>) : null}
                  </span>
                </React.Fragment>))}
              </div>
            </div>
          </>) : null}
          {' '}
          {v.pg?.hasSearch ? (<>
            <div style={css("flex:none;width:300px;max-width:100%;display:flex;align-items:center;gap:8px;height:38px;padding:0 10px;border-radius:11px;border:1px solid #E9EBEF;background:#FAFBFC;color:#98A2B3")}>
              <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg) center/contain no-repeat;")} />
              <input style={css("flex:1;min-width:0;border:0;padding:0;background:transparent;font:500 13px 'Geist';color:#0A1020;box-shadow:none !important")} value={v.pg?.q} onChange={v.pg?.onQ} placeholder={v.pg?.search} />
              {v.pg?.hasQ ? (<>
                <span style={css("display:grid;cursor:pointer")} onClick={v.pg?.clearQ}>
                  <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;")} />
                </span>
              </>) : null}
            </div>
          </>) : null}
          {' '}
          <span style={css("flex:none;height:38px;padding:0 12px;border-radius:11px;border:1px solid #E9EBEF;background:#fff;display:flex;align-items:center;gap:6px;font:550 12.5px 'Geist';color:#344054;cursor:pointer")} onClick={v.pg?.table?.densGo} title="Row density">
            <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/sliders-horizontal-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/sliders-horizontal-duotone.svg) center/contain no-repeat;")} />
            {v.pg?.table?.densL}
          </span>
          <div style={css("position:relative;flex:none")}>
            <span style={css(`height:38px;padding:0 12px;border-radius:11px;border:1px solid ${v.flt?.bd??""};background:${v.flt?.bg??""};display:flex;align-items:center;gap:6px;font:550 12.5px 'Geist';color:${v.flt?.fg??""};cursor:pointer`)} onClick={v.flt?.toggle}>
              <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/funnel-simple.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/funnel-simple.svg) center/contain no-repeat;")} />
              Filter
              {v.flt?.hasN ? (<>
                <span style={css("min-width:18px;height:18px;padding:0 5px;border-radius:6px;background:#12B8A8;color:#fff;display:grid;place-items:center;font:600 10.5px 'Geist Mono'")}>
                  {v.flt?.n}
                </span>
              </>) : null}
            </span>
            {' '}
            {v.flt?.open ? (<>
              <div style={css("position:absolute;right:0;top:46px;width:320px;padding:16px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFCFD 100%);border:1px solid rgba(16,24,40,.07);border-radius:20px;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16);box-shadow:0 30px 60px -24px rgba(16,24,40,.35);z-index:15;animation:zoomIn .15s ease both")}>
                {(v.flt?.groups||[]).map((fg,i8)=>(<React.Fragment key={i8}>
                  <div style={css("margin-bottom:14px")}>
                    <p style={css("font:600 12px 'Geist';color:#344054")}>
                      {fg?.l}
                    </p>
                    <div style={css("margin-top:8px;display:flex;flex-wrap:wrap;gap:6px")}>
                      {(fg?.opts||[]).map((fo,i11)=>(<React.Fragment key={i11}>
                        <span style={css(`height:32px;padding:0 11px;border-radius:9px;background:${fo?.bg??""};color:${fo?.fg??""};border:1px solid ${fo?.bd??""};display:grid;place-items:center;font:550 12px 'Geist';cursor:pointer`)} onClick={fo?.go}>
                          {fo?.n}
                        </span>
                      </React.Fragment>))}
                    </div>
                  </div>
                </React.Fragment>))}
                <div style={css("display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid #F2F4F7")}>
                  <span style={css("font:550 12.5px 'Geist';color:#667085;cursor:pointer")} onClick={v.flt?.clear}>
                    Clear all
                  </span>
                  <span style={css("height:34px;padding:0 14px;border-radius:10px;background:linear-gradient(180deg,#22C7B5,#0FA898);color:#fff;display:grid;place-items:center;font:600 12.5px 'Geist';cursor:pointer")} onClick={v.flt?.toggle}>
                    {"Show "}{v.flt?.cnt}
                  </span>
                </div>
              </div>
            </>) : null}
          </div>
        </div>
        {' '}
        {v.pg?.hasBulk ? (<>
          <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 12px 10px;padding:8px 10px 8px 14px;border-radius:14px;background:linear-gradient(180deg,#F0FDFA,#E6FAF6);border:1px solid #BFEFE6;color:#0B6B61;box-shadow:0 8px 18px -14px rgba(18,184,168,.8);animation:rise .2s ease both")}>
            <span style={css("font:600 13px 'Geist';margin-right:8px")}>
              {v.pg?.bulkN}
            </span>
            {(v.pg?.bulk||[]).map((b,i6)=>(<React.Fragment key={i6}>
              <Hx as="span" s={`height:32px;padding:0 11px;border-radius:9px;background:${b?.bg??""};color:${b?.fg??""};border:1px solid ${b?.bd??""};box-shadow:0 1px 2px rgba(10,16,32,.06),inset 0 1px 0 rgba(255,255,255,.08);display:inline-flex;align-items:center;gap:7px;font:550 12.5px 'Geist';letter-spacing:-.005em;cursor:pointer;white-space:nowrap;transition:filter .15s,transform .1s`} h={"filter:brightness(.96)"} a={"transform:scale(.97)"} onClick={b?.go}>
                <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${b?.ic??""}) center/contain no-repeat;mask:url(${b?.ic??""}) center/contain no-repeat;`)} />
                {b?.n}
              </Hx>
            </React.Fragment>))}
            <span style={css("margin-left:auto;font:550 12.5px 'Geist';color:#0B6B61;cursor:pointer")} onClick={v.pg?.clearSel}>
              Clear
            </span>
          </div>
        </>) : null}
        {' '}
        <div style={css("overflow:auto;max-height:calc(100vh - 250px);min-height:240px")}>
          <div style={css("min-width:900px")}>
            <div style={css(`position:sticky;top:0;z-index:3;display:grid;grid-template-columns:${v.pg?.table?.gridT??""};gap:16px;align-items:center;height:40px;padding:0 20px;background:rgba(250,251,252,.97);backdrop-filter:blur(6px);border-top:1px solid #F0F2F5;border-bottom:1px solid #F0F2F5`)}>
              {(v.pg?.table?.cols||[]).map((h,i7)=>(<React.Fragment key={i7}>
                <div style={css(`display:flex;justify-content:${h?.jc??""};font:550 11.5px 'Geist';color:#667085;white-space:nowrap`)}>
                  {h?.isCk ? (<>
                    <span style={css(`width:18px;height:18px;border-radius:6px;background:${h?.ckBg??""};border:1.5px solid ${h?.ckBd??""};display:grid;place-items:center;color:#fff;cursor:pointer`)} onClick={h?.go}>
                      <span style={css("flex:none;width:12px;height:12px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;")} />
                    </span>
                  </>) : null}
                  {h?.n}
                </div>
              </React.Fragment>))}
            </div>
            {' '}
            {(v.pg?.table?.rows||[]).map((r,i6)=>(<React.Fragment key={i6}>
              <Hx as="div" s={`display:grid;grid-template-columns:${v.pg?.table?.gridT??""};gap:16px;align-items:center;min-height:${v.pg?.table?.rh??""};padding:7px 20px;background:${r?.bg??""};border-bottom:1px solid #F2F4F7;cursor:pointer;transition:background .12s`} h={"background:#FAFCFC"} onClick={r?.open}>
                {(r?.cells||[]).map((c,i8)=>(<React.Fragment key={i8}>
                  <div style={css(`min-width:0;display:flex;align-items:center;justify-content:${c?.jc??""}`)}>
                    {c?.isTx ? (<>
                      <div style={css(`min-width:0;max-width:100%;text-align:${c?.al??""}`)}>
                        <p style={css(`font:${c?.ft??""} 'Geist';letter-spacing:-.005em;color:${c?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums`)}>
                          {c?.t}
                        </p>
                        {c?.hasS ? (<>
                          <p style={css("margin-top:2px;font:400 12px 'Geist';color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                            {c?.s}
                          </p>
                        </>) : null}
                      </div>
                    </>) : null}
                    {' '}
                    {c?.isBd ? (<>
                      <span style={css(`display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:8px;background:${c?.bg??""};color:${c?.fg??""};box-shadow:inset 0 0 0 1px rgba(10,16,32,.05);font:550 12px 'Geist';white-space:nowrap`)}>
                        <span style={css("width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px rgba(255,255,255,.6)")} />
                        {c?.t}
                      </span>
                    </>) : null}
                    {' '}
                    {c?.isBar ? (<>
                      <div style={css("width:100%;min-width:0;padding-right:12px")}>
                        <div style={css("display:flex;justify-content:space-between;gap:8px;font:550 12.5px 'Geist'")}>
                          <span style={css("white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                            {c?.t}
                          </span>
                          <span style={css("flex:none;font:500 11.5px 'Geist Mono';color:#667085")}>
                            {c?.t2}
                          </span>
                        </div>
                        <div style={css("margin-top:7px;height:6px;border-radius:99px;background:#F2F4F7;overflow:hidden")}>
                          <span style={css(`display:block;height:100%;width:${c?.w??""};border-radius:99px;background:${c?.c??""};animation:grow .7s cubic-bezier(.2,.8,.2,1) both`)} />
                        </div>
                      </div>
                    </>) : null}
                    {' '}
                    {c?.isAc ? (<>
                      <div style={css("display:flex;gap:6px;justify-content:flex-end")}>
                        {(c?.acts||[]).map((b,i12)=>(<React.Fragment key={i12}>
                          <Hx as="span" s={`height:32px;padding:0 11px;border-radius:9px;background:${b?.bg??""};color:${b?.fg??""};border:1px solid ${b?.bd??""};box-shadow:0 1px 2px rgba(10,16,32,.06),inset 0 1px 0 rgba(255,255,255,.08);display:inline-flex;align-items:center;gap:7px;font:550 12.5px 'Geist';letter-spacing:-.005em;cursor:pointer;white-space:nowrap;transition:filter .15s,transform .1s`} h={"filter:brightness(.96)"} a={"transform:scale(.97)"} onClick={b?.go}>
                            <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${b?.ic??""}) center/contain no-repeat;mask:url(${b?.ic??""}) center/contain no-repeat;`)} />
                            {b?.n}
                          </Hx>
                        </React.Fragment>))}
                      </div>
                    </>) : null}
                    {' '}
                    {c?.isCk ? (<>
                      <span style={css(`width:18px;height:18px;border-radius:6px;background:${c?.bg??""};border:1.5px solid ${c?.bd??""};display:grid;place-items:center;color:#fff;cursor:pointer`)} onClick={c?.go}>
                        <span style={css("flex:none;width:12px;height:12px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;")} />
                      </span>
                    </>) : null}
                    {' '}
                    {c?.isAv ? (<>
                      <div style={css("min-width:0;display:flex;align-items:center;gap:11px")}>
                        <span style={css(`flex:none;width:34px;height:34px;border-radius:11px;background:${c?.bg??""};box-shadow:inset 0 0 0 1px rgba(10,16,32,.06);display:grid;place-items:center;font:650 12px 'Geist';color:#0A1020`)}>
                          {c?.ini}
                        </span>
                        <div style={css("min-width:0")}>
                          <p style={css("font:550 13.5px 'Geist';letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                            {c?.t}
                          </p>
                          {c?.hasS ? (<>
                            <p style={css("margin-top:1px;font:400 12px 'Geist';color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                              {c?.s}
                            </p>
                          </>) : null}
                        </div>
                      </div>
                    </>) : null}
                    {' '}
                    {c?.isTg ? (<>
                      <span style={css(`flex:none;width:38px;height:22px;border-radius:99px;background:${c?.bg??""};padding:2px;display:flex;justify-content:${c?.j??""};cursor:pointer;transition:background .2s`)} onClick={c?.go}>
                        <span style={css("width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(10,16,32,.25)")} />
                      </span>
                    </>) : null}
                  </div>
                </React.Fragment>))}
              </Hx>
            </React.Fragment>))}
            {' '}
            {v.pg?.table?.isSk ? (<>
              {(v.pg?.table?.sk||[]).map((sk,i7)=>(<React.Fragment key={i7}>
                <div style={css("display:flex;align-items:center;gap:18px;height:62px;padding:0 20px;border-bottom:1px solid #F2F4F7")}>
                  <span style={css("width:34px;height:34px;border-radius:11px;background:linear-gradient(90deg,#F2F4F7 25%,#FAFBFC 50%,#F2F4F7 75%);background-size:800px 100%;animation:shimmer 1.2s linear infinite")} />
                  <div style={css("flex:1;display:flex;flex-direction:column;gap:8px")}>
                    <span style={css(`height:10px;width:${sk?.w1??""};border-radius:99px;background:linear-gradient(90deg,#F2F4F7 25%,#FAFBFC 50%,#F2F4F7 75%);background-size:800px 100%;animation:shimmer 1.2s linear infinite`)} />
                    <span style={css(`height:8px;width:${sk?.w2??""};border-radius:99px;background:linear-gradient(90deg,#F2F4F7 25%,#FAFBFC 50%,#F2F4F7 75%);background-size:800px 100%;animation:shimmer 1.2s linear infinite`)} />
                  </div>
                  <span style={css("width:90px;height:22px;border-radius:8px;background:#F2F4F7")} />
                </div>
              </React.Fragment>))}
            </>) : null}
            {' '}
            {v.pg?.table?.empty ? (<>
              <div style={css("padding:64px 20px;display:flex;flex-direction:column;align-items:center;text-align:center")}>
                <span style={css("width:60px;height:60px;border-radius:18px;background:linear-gradient(150deg,#E6FAF6,#EEF2FF);color:#0B7A6F;display:grid;place-items:center;box-shadow:inset 0 0 0 1px #D5F5EF")}>
                  <span style={css("flex:none;width:24px;height:24px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/tray-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/tray-duotone.svg) center/contain no-repeat;")} />
                </span>
                <p style={css("margin-top:16px;font:600 16px 'Geist';letter-spacing:-.015em")}>
                  {v.pg?.table?.emptyT}
                </p>
                <p style={css("margin-top:4px;font:400 13.5px 'Geist';color:#667085")}>
                  {v.pg?.table?.emptyS}
                </p>
              </div>
            </>) : null}
          </div>
        </div>
        {' '}
        <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 16px;border-top:1px solid #F0F2F5;background:#FCFDFD")}>
          <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap;font:500 12.5px 'Geist';color:#667085")}>
            <span>
              Rows per page
            </span>
            <div style={css("display:flex;padding:3px;border-radius:10px;background:#F2F4F7")}>
              {(v.pg?.table?.psOpts||[]).map((po,i7)=>(<React.Fragment key={i7}>
                <span style={css(`height:26px;min-width:34px;padding:0 8px;border-radius:7px;background:${po?.bg??""};color:${po?.fg??""};box-shadow:${po?.sh??""};display:grid;place-items:center;font:600 12px 'Geist Mono';cursor:pointer`)} onClick={po?.go}>
                  {po?.n}
                </span>
              </React.Fragment>))}
            </div>
            <span style={css("color:#98A2B3")}>
              ·
            </span>
            <span style={css("font-family:'Geist Mono'")}>
              {v.pg?.table?.pgL}
            </span>
          </div>
          <div style={css("display:flex;align-items:center;gap:4px")}>
            <span style={css(`width:32px;height:32px;border-radius:9px;border:1px solid #E4E7EC;background:#fff;display:grid;place-items:center;color:#344054;opacity:${v.pg?.table?.pOp??""};cursor:pointer`)} onClick={v.pg?.table?.prev}>
              <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-left.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-left.svg) center/contain no-repeat;")} />
            </span>
            {(v.pg?.table?.pages||[]).map((pp,i6)=>(<React.Fragment key={i6}>
              <span style={css(`min-width:32px;height:32px;padding:0 8px;border-radius:9px;background:${pp?.bg??""};color:${pp?.fg??""};box-shadow:${pp?.sh??""};display:grid;place-items:center;font:600 12.5px 'Geist Mono';cursor:pointer`)} onClick={pp?.go}>
                {pp?.n}
              </span>
            </React.Fragment>))}
            <span style={css(`width:32px;height:32px;border-radius:9px;border:1px solid #E4E7EC;background:#fff;display:grid;place-items:center;color:#344054;opacity:${v.pg?.table?.nOp??""};cursor:pointer`)} onClick={v.pg?.table?.next}>
              <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-right.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-right.svg) center/contain no-repeat;")} />
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
