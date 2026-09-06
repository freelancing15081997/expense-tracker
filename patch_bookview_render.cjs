const fs = require('fs');
let content = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

const desktopRenderOld = `<div className="flex items-center justify-end gap-1.5 font-bold">
                              {(exp.entryType === 'in' || exp.entryType === 'in') ? (
                                <span className="text-emerald-600">+{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              ) : (
                                <span className="text-slate-900">-{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              )}
                            </div>`;

const desktopRenderNew = `<div className="flex items-center justify-end gap-1.5 font-bold">
                              {exp.entryType === 'in' ? (
                                <span className="text-emerald-600">+{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              ) : exp.entryType === 'transfer' ? (
                                <span className="text-blue-600">{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              ) : (
                                <span className="text-slate-900">-{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              )}
                            </div>`;

content = content.replace(desktopRenderOld, desktopRenderNew);

const mobileRenderOld = `<div className={cn("font-bold text-[14px] whitespace-nowrap", (exp.entryType === 'in' || exp.entryType === 'in') ? "text-emerald-600" : "text-zinc-900")}>{(exp.entryType === 'in' || exp.entryType === 'in') ? '+' : ''}{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>`;

const mobileRenderNew = `<div className={cn("font-bold text-[14px] whitespace-nowrap", exp.entryType === 'in' ? "text-emerald-600" : exp.entryType === 'transfer' ? "text-blue-600" : "text-slate-900")}>{exp.entryType === 'in' ? '+' : exp.entryType === 'transfer' ? '' : '-'}{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>`;

content = content.replace(mobileRenderOld, mobileRenderNew);

fs.writeFileSync('src/pages/BookView.tsx', content);
