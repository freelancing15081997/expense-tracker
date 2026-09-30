import React from 'react';
import ByjanMark from '../brand/ByjanMark.jsx';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';

export default function Modal({ v }) {
  return (
    <>
      <div style={css("position:absolute;inset:0;z-index:40;display:grid;place-items:center;padding:24px")}>
        <div style={css("position:absolute;inset:0;background:rgba(10,16,32,.5);backdrop-filter:blur(3px);animation:fade .2s ease both")} onClick={v.modal?.close} />
        {' '}
        <div style={css(`position:relative;width:${v.modal?.w??""};max-width:100%;max-height:calc(100vh - 48px);overflow-y:auto;background:#fff;border-radius:24px;box-shadow:0 40px 80px -30px rgba(10,16,32,.6),0 0 0 1px rgba(10,16,32,.06);animation:zoomIn .2s ease both`)}>
          <div style={css("position:sticky;top:0;z-index:1;display:flex;align-items:flex-start;gap:12px;padding:20px 22px 14px;background:#fff;border-bottom:1px solid #F2F4F7")}>
            <div style={css("flex:1;min-width:0")}>
              <h3 style={css("font:650 18px 'Geist';letter-spacing:-.01em")}>
                {v.modal?.title}
              </h3>
              <p style={css("margin-top:3px;font:500 13px/1.5 'Geist';color:#667085")}>
                {v.modal?.sub}
              </p>
            </div>
            <span style={css("width:34px;height:34px;border-radius:9px;display:grid;place-items:center;cursor:pointer;color:#475467")} onClick={v.modal?.close}>
              <span style={css("flex:none;width:18px;height:18px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg) center/contain no-repeat;")} />
            </span>
          </div>
          {' '}
          <div style={css("padding:18px 22px 22px")}>
            {v.modal?.isPay ? (<>
              <div style={css("display:flex;flex-direction:column;gap:14px")}>
                <div>
                  <p style={css("font:600 12px 'Geist';color:#475467;margin-bottom:6px")}>
                    Amount
                  </p>
                  <div style={css("display:flex;align-items:center;gap:8px;height:56px;padding:0 14px;border-radius:12px;border:1.5px solid #E4E7EC")}>
                    <span style={css("font:650 22px 'Geist';color:#98A2B3")}>
                      ₹
                    </span>
                    <input style={css("flex:1;min-width:0;border:0;padding:0;font:600 26px 'Geist Mono';color:#0A1020;box-shadow:none !important;letter-spacing:-.04em")} value={v.modal?.amt} onChange={v.modal?.onAmt} inputMode="decimal" />
                    <span style={css("height:30px;padding:0 10px;border-radius:8px;background:#F5F6F8;display:grid;place-items:center;font:600 12px 'Geist';cursor:pointer")} onClick={v.modal?.half}>
                      Half
                    </span>
                    <span style={css("height:30px;padding:0 10px;border-radius:8px;background:#E3F7F4;color:#0B7A6F;display:grid;place-items:center;font:600 12px 'Geist';cursor:pointer")} onClick={v.modal?.full}>
                      Full balance
                    </span>
                  </div>
                  <p style={css("margin-top:6px;font:500 12px 'Geist';color:#0B7A6F")}>
                    {v.modal?.after}
                  </p>
                </div>
                {' '}
                <div>
                  <p style={css("font:600 12px 'Geist';color:#475467;margin-bottom:6px")}>
                    Paid by
                  </p>
                  <div style={css("display:flex;gap:6px;flex-wrap:wrap")}>
                    {(v.modal?.modes||[]).map((c,i10)=>(<React.Fragment key={i10}>
                      <span style={css(`height:36px;padding:0 14px;border-radius:99px;background:${c?.bg??""};color:${c?.fg??""};border:1px solid ${c?.bd??""};display:grid;place-items:center;font:600 12.5px 'Geist';cursor:pointer`)} onClick={c?.go}>
                        {c?.n}
                      </span>
                    </React.Fragment>))}
                  </div>
                </div>
                {' '}
                <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:12px")}>
                  <div>
                    <p style={css("font:600 12px 'Geist';color:#475467;margin-bottom:6px")}>
                      Into account
                    </p>
                    <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${v.modal?.dAcc?.bd??""};background:#fff;box-shadow:${v.modal?.dAcc?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%`} h={"border-color:#99E6DA"} onClick={v.modal?.dAcc?.open}>
                      {v.modal?.dAcc?.hasIc ? (<>
                        <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${v.modal?.dAcc?.icBg??""};color:${v.modal?.dAcc?.icFg??""};display:grid;place-items:center`)}>
                          <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${v.modal?.dAcc?.ic??""}) center/contain no-repeat;mask:url(${v.modal?.dAcc?.ic??""}) center/contain no-repeat;`)} />
                        </span>
                      </>) : null}
                      <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${v.modal?.dAcc?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                        {v.modal?.dAcc?.label}
                      </span>
                      <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                    </Hx>
                  </div>
                  <div>
                    <p style={css("font:600 12px 'Geist';color:#475467;margin-bottom:6px")}>
                      Date
                    </p>
                    <Hx as="div" s={`display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 8px;border-radius:12px;border:1px solid ${v.modal?.dWhen?.bd??""};background:#fff;box-shadow:${v.modal?.dWhen?.sh??""};cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s;width:100%`} h={"border-color:#99E6DA"} onClick={v.modal?.dWhen?.open}>
                      {v.modal?.dWhen?.hasIc ? (<>
                        <span style={css(`flex:none;width:26px;height:26px;border-radius:8px;background:${v.modal?.dWhen?.icBg??""};color:${v.modal?.dWhen?.icFg??""};display:grid;place-items:center`)}>
                          <span style={css(`flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(${v.modal?.dWhen?.ic??""}) center/contain no-repeat;mask:url(${v.modal?.dWhen?.ic??""}) center/contain no-repeat;`)} />
                        </span>
                      </>) : null}
                      <span style={css(`flex:1;min-width:0;padding-left:4px;font:500 13.5px 'Geist';color:${v.modal?.dWhen?.fg??""};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                        {v.modal?.dWhen?.label}
                      </span>
                      <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg) center/contain no-repeat;color:#98A2B3")} />
                    </Hx>
                  </div>
                </div>
                {' '}
                <div>
                  <p style={css("font:600 12px 'Geist';color:#475467;margin-bottom:6px")}>
                    Reference
                  </p>
                  <input style={css("width:100%;height:40px;padding:0 12px;border-radius:11px;border:1px solid #E4E7EC;font:500 13.5px 'Geist'")} value={v.modal?.ref} onChange={v.modal?.onRef} placeholder={v.modal?.refPh} />
                </div>
                {' '}
                {v.modal?.showTds ? (<>
                  <div style={css("display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:#F8FAFB")}>
                    <span style={css("flex:1;font:500 13px 'Geist'")}>
                      {v.modal?.tdsL}
                    </span>
                    <span style={css(`flex:none;width:40px;height:24px;border-radius:99px;background:${v.modal?.tdsBg??""};padding:3px;display:flex;justify-content:${v.modal?.tdsJ??""};cursor:pointer;transition:background .2s`)} onClick={v.modal?.tdsTg}>
                      <span style={css("width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)")} />
                    </span>
                  </div>
                </>) : null}
              </div>
            </>) : null}
            {' '}
            {v.modal?.isEmail ? (<>
              <div style={css("display:flex;flex-direction:column;gap:12px")}>
                <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:12px")}>
                  <div>
                    <p style={css("font:600 12px 'Geist';color:#475467;margin-bottom:6px")}>
                      To
                    </p>
                    <input style={css("height:40px;padding:0 12px;border-radius:11px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;width:100%")} value={v.modal?.to} onChange={v.modal?.onTo} placeholder="email@company.in" />
                  </div>
                  <div>
                    <p style={css("font:600 12px 'Geist';color:#475467;margin-bottom:6px")}>
                      Cc
                    </p>
                    <input style={css("height:40px;padding:0 12px;border-radius:11px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;width:100%")} value={v.modal?.cc} onChange={v.modal?.onCc} placeholder="" />
                  </div>
                </div>
                <div>
                  <p style={css("font:600 12px 'Geist';color:#475467;margin-bottom:6px")}>
                    Subject
                  </p>
                  <input style={css("height:40px;padding:0 12px;border-radius:11px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;width:100%")} value={v.modal?.subj} onChange={v.modal?.onSubj} placeholder="" />
                </div>
                <div>
                  <p style={css("font:600 12px 'Geist';color:#475467;margin-bottom:6px")}>
                    Message
                  </p>
                  <textarea style={css("width:100%;min-height:160px;padding:10px 12px;border-radius:11px;border:1px solid #E4E7EC;font:500 13.5px/1.55 'Geist';color:#0A1020;resize:vertical")} value={v.modal?.body} onChange={v.modal?.onBody} />
                </div>
                <div style={css("display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;background:#F8FAFB")}>
                  <span style={css("width:34px;height:40px;border-radius:6px;background:#FDECEA;color:#B42318;display:grid;place-items:center;font:650 9px 'Geist'")}>
                    PDF
                  </span>
                  <span style={css("flex:1;font:500 13px 'Geist'")}>
                    {v.modal?.file}
                  </span>
                  <span style={css(`flex:none;width:40px;height:24px;border-radius:99px;background:${v.modal?.pdfBg??""};padding:3px;display:flex;justify-content:${v.modal?.pdfJ??""};cursor:pointer;transition:background .2s`)} onClick={v.modal?.pdfTg}>
                    <span style={css("width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)")} />
                  </span>
                </div>
                <span style={css("align-self:flex-start;font:600 13px 'Geist';color:#0B7A6F;cursor:pointer")} onClick={v.modal?.wa}>
                  Send on WhatsApp instead →
                </span>
              </div>
            </>) : null}
            {' '}
            {v.modal?.isVoid ? (<>
              <div style={css("display:flex;flex-direction:column;gap:12px")}>
                <p style={css("font:600 12px 'Geist';color:#475467;margin-bottom:6px")}>
                  Reason
                </p>
                <div style={css("display:flex;gap:6px;flex-wrap:wrap")}>
                  {(v.modal?.reasons||[]).map((c,i9)=>(<React.Fragment key={i9}>
                    <span style={css(`height:36px;padding:0 14px;border-radius:99px;background:${c?.bg??""};color:${c?.fg??""};border:1px solid ${c?.bd??""};display:grid;place-items:center;font:600 12.5px 'Geist';cursor:pointer`)} onClick={c?.go}>
                      {c?.n}
                    </span>
                  </React.Fragment>))}
                </div>
                <input style={css("height:40px;padding:0 12px;border-radius:11px;border:1px solid #E4E7EC;background:#fff;font:500 13.5px 'Geist';color:#0A1020;width:100%")} value={v.modal?.note} onChange={v.modal?.onNote} placeholder="Add a note (optional)" />
              </div>
            </>) : null}
            {' '}
            {v.modal?.isPdf ? (<>
              <div style={css("padding:32px 36px;border:1px solid #E4E8EE;border-radius:6px;background:#fff;box-shadow:0 10px 30px -20px rgba(11,31,58,.4)")}>
                <div style={css("display:flex;justify-content:space-between;gap:20px")}>
                  <div style={css("display:flex;gap:12px")}>
                    <ByjanMark size={40} />
                    <div>
                      <p style={css("font:650 16px 'Geist'")}>
                        {v.modal?.co?.n}
                      </p>
                      <p style={css("font:500 11px/1.5 'Geist';color:#475467;max-width:260px")}>
                        {v.modal?.co?.addr}
                      </p>
                      <p style={css("font:500 11px 'Geist';color:#475467")}>
                        {"GSTIN "}{v.modal?.co?.g}
                      </p>
                    </div>
                  </div>
                  <div style={css("text-align:right")}>
                    <p style={css("font:650 18px 'Geist';letter-spacing:.04em;color:#0B7A6F")}>
                      {v.modal?.docT}
                    </p>
                    <p style={css("margin-top:4px;font:600 12px 'Geist'")}>
                      {v.modal?.no}
                    </p>
                    <p style={css("font:500 11px 'Geist';color:#475467")}>
                      {"Date "}{v.modal?.dt}
                    </p>
                    {v.modal?.hasDue ? (<>
                      <p style={css("font:500 11px 'Geist';color:#475467")}>
                        {"Due "}{v.modal?.due}
                      </p>
                    </>) : null}
                  </div>
                </div>
                {' '}
                <div style={css("margin-top:20px;padding:12px 14px;border-radius:8px;background:#F8FAFB")}>
                  <p style={css("font:600 10px 'Geist';letter-spacing:.08em;color:#98A2B3")}>
                    BILL TO
                  </p>
                  <p style={css("margin-top:3px;font:650 13px 'Geist'")}>
                    {v.modal?.pn}
                  </p>
                  <p style={css("font:500 11px 'Geist';color:#475467")}>
                    {v.modal?.pa}{" · "}{v.modal?.pg}
                  </p>
                </div>
                {' '}
                <div style={css("margin-top:16px")}>
                  <div style={css("display:grid;grid-template-columns:24px 1fr 60px 80px 90px 44px 100px;gap:8px;padding:8px 0;border-bottom:1.5px solid #0A1020;font:600 10px 'Geist';letter-spacing:.04em;color:#475467")}>
                    <span>
                      #
                    </span>
                    <span>
                      ITEM
                    </span>
                    <span>
                      HSN
                    </span>
                    <span style={css("text-align:right")}>
                      QTY
                    </span>
                    <span style={css("text-align:right")}>
                      RATE
                    </span>
                    <span style={css("text-align:right")}>
                      GST
                    </span>
                    <span style={css("text-align:right")}>
                      AMOUNT
                    </span>
                  </div>
                  {(v.modal?.lines||[]).map((ln,i9)=>(<React.Fragment key={i9}>
                    <div style={css("display:grid;grid-template-columns:24px 1fr 60px 80px 90px 44px 100px;gap:8px;padding:9px 0;border-bottom:1px solid #EEF1F5;font:500 11.5px 'Geist';font-variant-numeric:tabular-nums")}>
                      <span>
                        {ln?.n}
                      </span>
                      <span>
                        {ln?.d}
                      </span>
                      <span>
                        {ln?.h}
                      </span>
                      <span style={css("text-align:right")}>
                        {ln?.q}
                      </span>
                      <span style={css("text-align:right")}>
                        {ln?.r}
                      </span>
                      <span style={css("text-align:right")}>
                        {ln?.g}
                      </span>
                      <span style={css("text-align:right")}>
                        {ln?.a}
                      </span>
                    </div>
                  </React.Fragment>))}
                </div>
                {' '}
                <div style={css("margin-top:12px;display:flex;justify-content:space-between;gap:20px")}>
                  <div style={css("font:500 10.5px/1.6 'Geist';color:#475467")}>
                    <p style={css("font:600 10px 'Geist';letter-spacing:.08em;color:#98A2B3")}>
                      PAY TO
                    </p>
                    <p>
                      {v.modal?.co?.bank}
                    </p>
                    <p>
                      {"UPI "}{v.modal?.co?.upi}
                    </p>
                  </div>
                  <div style={css("width:240px;display:flex;flex-direction:column;gap:5px")}>
                    {(v.modal?.tot||[]).map((tt,i10)=>(<React.Fragment key={i10}>
                      <div style={css(`display:flex;justify-content:space-between;padding-top:4px;border-top:${tt?.bt??""};font:${tt?.ft??""} 'Geist';font-variant-numeric:tabular-nums`)}>
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
                <p style={css("margin-top:22px;font:500 10px 'Geist';color:#98A2B3;text-align:center")}>
                  Made with Byjan · This is a computer-generated document
                </p>
              </div>
            </>) : null}
            {' '}
            {v.modal?.isForm ? (<>
              <div style={css("display:flex;flex-direction:column;gap:14px")}>
                {(v.modal?.fields||[]).map((fl,i8)=>(<React.Fragment key={i8}>
                  <div>
                    <p style={css("font:600 12px 'Geist';color:#475467;margin-bottom:6px")}>
                      {fl?.l}
                    </p>
                    {fl?.isIn ? (<>
                      <input style={css(`width:100%;height:42px;padding:0 12px;border-radius:11px;border:1px solid #E4E7EC;font:${fl?.ff??""};color:#0A1020`)} value={fl?.v} onChange={fl?.on} placeholder={fl?.ph} inputMode={fl?.im} />
                    </>) : null}
                    {fl?.isArea ? (<>
                      <textarea style={css("width:100%;min-height:90px;padding:10px 12px;border-radius:11px;border:1px solid #E4E7EC;font:500 13.5px/1.5 'Geist';color:#0A1020;resize:vertical")} value={fl?.v} onChange={fl?.on} placeholder={fl?.ph} />
                    </>) : null}
                    {fl?.isSel ? (<>
                      <select style={css("height:40px;padding:0 34px 0 12px;border-radius:11px;border:1px solid #E4E7EC;background:#fff url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-down.svg) right 10px center/15px no-repeat;appearance:none;-webkit-appearance:none;font:500 13.5px 'Geist';color:#0A1020;cursor:pointer;width:100%;height:42px")} value={fl?.v} onChange={fl?.on}>
                        {(fl?.opts||[]).map((o,i12)=>(<React.Fragment key={i12}>
                          <option value={o?.v}>
                            {o?.n}
                          </option>
                        </React.Fragment>))}
                      </select>
                    </>) : null}
                  </div>
                </React.Fragment>))}
              </div>
            </>) : null}
            {' '}
            {v.modal?.isConfirm ? (<>
              <p style={css("font:500 14px/1.6 'Geist';color:#344054")}>
                {v.modal?.body}
              </p>
            </>) : null}
            {' '}
            {v.modal?.isImport ? (<>
              <div>
                <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:8px")}>
                  {(v.modal?.steps||[]).map((st,i9)=>(<React.Fragment key={i9}>
                    <div>
                      <span style={css(`display:block;height:4px;border-radius:2px;background:${st?.bg??""}`)} />
                      <p style={css(`margin-top:6px;font:600 12px 'Geist';color:${st?.fg??""}`)}>
                        {st?.n}
                      </p>
                    </div>
                  </React.Fragment>))}
                </div>
                {' '}
                {v.modal?.s0 ? (<>
                  <div style={css("margin-top:16px;padding:36px 20px;border:2px dashed #9BD9D0;border-radius:14px;background:#F6FCFB;text-align:center;cursor:pointer")} onClick={v.modal?.pick}>
                    <span style={css("margin:0 auto;width:52px;height:52px;border-radius:15px;background:#E3F7F4;color:#0B7A6F;display:grid;place-items:center")}>
                      <span style={css("flex:none;width:24px;height:24px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/cloud-arrow-up-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/cloud-arrow-up-duotone.svg) center/contain no-repeat;")} />
                    </span>
                    <p style={css("margin-top:12px;font:650 15px 'Geist'")}>
                      Drop a file here or click to choose
                    </p>
                    <p style={css("margin-top:4px;font:500 12.5px 'Geist';color:#667085")}>
                      .xlsx, .csv, Tally .xml or bank .pdf · up to 20 MB
                    </p>
                  </div>
                </>) : null}
                {' '}
                {v.modal?.s1 ? (<>
                  <div style={css("margin-top:16px")}>
                    <p style={css("font:600 13px 'Geist'")}>
                      sharma-sep-2026.xlsx · 126 rows
                    </p>
                    <div style={css("margin-top:10px;border:1px solid #EEF1F5;border-radius:12px;overflow:hidden")}>
                      {(v.modal?.cols||[]).map((c,i11)=>(<React.Fragment key={i11}>
                        <div style={css("display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid #F2F4F7")}>
                          <span style={css("flex:1;font:500 13px 'Geist'")}>
                            {c?.a}
                          </span>
                          <span style={css("flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/arrow-right.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/arrow-right.svg) center/contain no-repeat;color:#98A2B3")} />
                          <span style={css(`width:140px;height:30px;padding:0 10px;border-radius:8px;background:${c?.bg??""};color:${c?.fg??""};display:flex;align-items:center;font:600 12px 'Geist'`)}>
                            {c?.b}
                          </span>
                        </div>
                      </React.Fragment>))}
                    </div>
                  </div>
                </>) : null}
                {' '}
                {v.modal?.s2 ? (<>
                  <div style={css("margin-top:22px;text-align:center")}>
                    <span style={css("margin:0 auto;width:60px;height:60px;border-radius:50%;background:#12B8A8;color:#fff;display:grid;place-items:center;animation:bjPop .5s ease both")}>
                      <span style={css("flex:none;width:28px;height:28px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg) center/contain no-repeat;")} />
                    </span>
                    <p style={css("margin-top:12px;font:650 17px 'Geist'")}>
                      126 rows imported
                    </p>
                    <p style={css("margin-top:4px;font:500 13px 'Geist';color:#667085")}>
                      3 duplicates skipped · you can undo this for 24 hours
                    </p>
                  </div>
                </>) : null}
              </div>
            </>) : null}
            {' '}
            {v.modal?.hasErr ? (<>
              <p style={css("margin-top:14px;display:flex;gap:8px;font:600 13px 'Geist';color:#B42318")}>
                <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/warning-circle-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/warning-circle-duotone.svg) center/contain no-repeat;")} />
                {v.modal?.err}
              </p>
            </>) : null}
            {' '}
            <div style={css("margin-top:20px;display:flex;justify-content:flex-end;gap:8px")}>
              {v.modal?.isPdf ? (<>
                <span style={css("height:42px;padding:0 16px;border-radius:11px;border:1px solid #E4E7EC;display:flex;align-items:center;gap:7px;font:600 13px 'Geist';cursor:pointer")} onClick={v.modal?.print}>
                  <span style={css("flex:none;width:15px;height:15px;background:currentColor;-webkit-mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/printer-duotone.svg) center/contain no-repeat;mask:url(https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/printer-duotone.svg) center/contain no-repeat;")} />
                  Print
                </span>
              </>) : null}
              <span style={css("height:42px;padding:0 16px;border-radius:11px;display:grid;place-items:center;font:600 13px 'Geist';color:#475467;cursor:pointer")} onClick={v.modal?.close}>
                Cancel
              </span>
              <Hx as="span" s={`height:42px;padding:0 18px;border-radius:11px;background:${v.modal?.okBg??""};color:#fff;display:grid;place-items:center;font:650 13.5px 'Geist';cursor:pointer`} h={"filter:brightness(1.1)"} onClick={v.modal?.run}>
                {v.modal?.ok}
              </Hx>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
