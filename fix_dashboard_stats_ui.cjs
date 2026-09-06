const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const uiAdd = `      {books.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-lg border border-zinc-200 shadow-sm flex flex-col justify-between">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Money In</h3>
            <span className="text-2xl font-bold text-emerald-600">+{globalStats.totalIn.toLocaleString()}</span>
          </div>
          <div className="bg-white p-5 rounded-lg border border-zinc-200 shadow-sm flex flex-col justify-between">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Money Out</h3>
            <span className="text-2xl font-bold text-zinc-900">-{globalStats.totalOut.toLocaleString()}</span>
          </div>
          <div className="bg-white p-5 rounded-lg border border-zinc-200 shadow-sm flex flex-col justify-between">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Top Contributor</h3>
            <span className="text-lg font-bold text-zinc-900 truncate">
              {Object.entries(globalStats.userActivity).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'No entries yet'}
            </span>
          </div>
        </div>
      )}

      {loading ? (`;

content = content.replace("{loading ? (", uiAdd);
fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log("Dashboard UI updated!");
