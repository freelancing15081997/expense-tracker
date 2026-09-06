const fs = require('fs');
let content = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// Replace desktop amount column rendering
const desktopAmountOld = `<span className="font-bold text-slate-900">{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>`;

const desktopAmountNew = `<div className="flex items-center justify-end gap-1.5 font-bold">
                              {exp.type === 'in' ? (
                                <span className="text-emerald-600">+{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              ) : (
                                <span className="text-slate-900">-{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              )}
                            </div>`;

content = content.replace(desktopAmountOld, desktopAmountNew);

fs.writeFileSync('src/pages/BookView.tsx', content);
console.log("Patched BookView table!");
