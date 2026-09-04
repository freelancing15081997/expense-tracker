import React, { useState } from 'react';
import { 
  TrendingUp, 
  PieChart, 
  Users, 
  CreditCard, 
  Wallet, 
  Calendar, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { Expense, DailyBudgetSettings } from '../types';
import { formatCurrency } from '../services/notificationEngine';

interface Props {
  expenses: Expense[];
  budgetSettings: DailyBudgetSettings;
  onOpenAddExpense: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#f59e0b', // Amber
  'Groceries': '#10b981', // Emerald
  'Rent & Housing': '#6366f1', // Indigo
  'Utilities': '#06b6d4', // Cyan
  'Transportation': '#3b82f6', // Blue
  'Shopping': '#ec4899', // Pink
  'Travel': '#8b5cf6', // Violet
  'Entertainment': '#f97316', // Orange
  'Healthcare': '#ef4444', // Red
  'Work & Office': '#64748b', // Slate
  'Miscellaneous': '#a855f7', // Purple
  'Other': '#94a3b8',
};

export const DashboardAnalytics: React.FC<Props> = ({
  expenses,
  budgetSettings,
  onOpenAddExpense,
}) => {
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const currency = budgetSettings.currency || '$';
  const totalSpend = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const monthlyLimit = budgetSettings.monthlyLimit || 2000;
  const budgetPercent = Math.min(100, Math.round((totalSpend / monthlyLimit) * 100));
  const remainingBudget = Math.max(0, monthlyLimit - totalSpend);
  const isOverBudget = totalSpend > monthlyLimit;

  // Calculate unique days with spend
  const uniqueDates = Array.from(new Set(expenses.map((e) => e.date))).sort();
  const dailyAverage = uniqueDates.length > 0 ? totalSpend / uniqueDates.length : 0;

  // Top Spender
  const spenderTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    spenderTotals[e.spenderName] = (spenderTotals[e.spenderName] || 0) + e.amount;
  });
  const sortedSpenders = Object.entries(spenderTotals).sort((a, b) => b[1] - a[1]);
  const topSpender = sortedSpenders[0] || ['None', 0];

  // Highest Single Expense
  const highestExpense = [...expenses].sort((a, b) => b.amount - a.amount)[0];

  // Category Totals
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    const cat = e.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + e.amount;
  });
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  // Payment Mode Totals
  const paymentTotals: Record<string, { total: number; count: number }> = {};
  expenses.forEach((e) => {
    const mode = e.paymentMode || 'Other';
    if (!paymentTotals[mode]) {
      paymentTotals[mode] = { total: 0, count: 0 };
    }
    paymentTotals[mode].total += e.amount;
    paymentTotals[mode].count += 1;
  });
  const sortedPaymentModes = Object.entries(paymentTotals).sort((a, b) => b[1].total - a[1].total);

  // Daily Spending Trend Data
  // Group by date
  const dateTotals: Record<string, { amount: number; count: number }> = {};
  expenses.forEach((e) => {
    if (!dateTotals[e.date]) {
      dateTotals[e.date] = { amount: 0, count: 0 };
    }
    dateTotals[e.date].amount += e.amount;
    dateTotals[e.date].count += 1;
  });

  // Sort dates chronologically
  const trendData = Object.entries(dateTotals)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, data]) => ({
      date,
      displayDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: data.amount,
      count: data.count,
    }));

  const maxTrendAmount = Math.max(...trendData.map((d) => d.amount), 10);

  // SVG dimensions for Trend Line Chart
  const svgWidth = 600;
  const svgHeight = 180;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  // Compute trend points
  const points = trendData.map((item, index) => {
    const x = paddingX + (index / Math.max(1, trendData.length - 1)) * chartWidth;
    const y = svgHeight - paddingY - (item.amount / maxTrendAmount) * chartHeight;
    return { ...item, x, y };
  });

  const pathD = points.length > 0
    ? points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : '';

  // Donut chart calculations
  let accumulatedAngle = 0;
  const donutRadius = 75;
  const donutStrokeWidth = 24;
  const centerCoord = 100;
  const circumference = 2 * Math.PI * donutRadius;

  return (
    <div id="dashboard-analytics-view" className="space-y-6">
      {/* 1. Real-time KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Spend */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Total Recorded Spend</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {formatCurrency(totalSpend, currency)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 mt-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Across {expenses.length} spreadsheet records</span>
            </div>
          </div>
        </div>

        {/* Monthly Budget Progress */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Monthly Budget</span>
            <div className={`p-2 rounded-lg ${isOverBudget ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
              {isOverBudget ? <AlertCircle className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl sm:text-3xl font-extrabold ${isOverBudget ? 'text-rose-600' : 'text-slate-900'}`}>
                {budgetPercent}%
              </span>
              <span className="text-xs text-slate-700 font-semibold">
                Limit: {formatCurrency(monthlyLimit, currency)}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isOverBudget ? 'bg-rose-500' : budgetPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, budgetPercent)}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-700 mt-1.5 font-medium flex justify-between">
              <span>{isOverBudget ? 'Over budget by' : 'Remaining balance:'}</span>
              <span className={`font-bold ${isOverBudget ? 'text-rose-600' : 'text-emerald-700'}`}>
                {isOverBudget
                  ? formatCurrency(totalSpend - monthlyLimit, currency)
                  : formatCurrency(remainingBudget, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Daily Average */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daily Average Spend</span>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {formatCurrency(dailyAverage, currency)}
            </div>
            <div className="text-xs text-slate-700 mt-1 font-medium">
              Daily Target: <span className="font-bold text-slate-700">{formatCurrency(budgetSettings.dailyLimit, currency)}/day</span>
            </div>
          </div>
        </div>

        {/* Top Contributor */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Top Spender</span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate" title={topSpender[0]}>
              {topSpender[0]}
            </div>
            <div className="text-xs text-slate-700 mt-1 font-semibold flex items-center justify-between">
              <span>Contribution:</span>
              <span className="text-amber-800 font-extrabold">{formatCurrency(topSpender[1], currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Dynamic Visualizations: Spending Trends & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dynamic Spending Trends Chart (2 Columns) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Dynamic Spending Trends
              </h3>
              <p className="text-xs text-slate-700">Chronological daily expenditures & trajectory</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Daily Spend
              </span>
              <span className="text-slate-700">Max day: {formatCurrency(maxTrendAmount, currency)}</span>
            </div>
          </div>

          {/* SVG Line & Area Chart */}
          <div className="relative w-full h-56 bg-slate-50/50 rounded-xl border border-slate-100 p-2 flex flex-col justify-end">
            {trendData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-700 text-xs">
                No expense trend data available yet
              </div>
            ) : (
              <div className="w-full h-full relative">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = svgHeight - paddingY - ratio * chartHeight;
                    return (
                      <g key={ratio}>
                        <line
                          x1={paddingX}
                          y1={y}
                          x2={svgWidth - paddingX}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="4,4"
                        />
                        <text
                          x={paddingX - 6}
                          y={y + 3}
                          fontSize="9"
                          fill="#94a3b8"
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {currency}{Math.round(ratio * maxTrendAmount)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area fill */}
                  <path d={areaD} fill="url(#trendGradient)" />

                  {/* Line stroke */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#059669"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Points with hover interaction */}
                  {points.map((pt, i) => (
                    <g key={pt.date} className="cursor-pointer">
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredTrendIndex === i ? 6 : 4}
                        fill="#ffffff"
                        stroke="#059669"
                        strokeWidth={hoveredTrendIndex === i ? 3 : 2}
                        onMouseEnter={() => setHoveredTrendIndex(i)}
                        onMouseLeave={() => setHoveredTrendIndex(null)}
                      />
                      {/* X axis labels */}
                      <text
                        x={pt.x}
                        y={svgHeight - 10}
                        fontSize="9"
                        fill="#64748b"
                        textAnchor="middle"
                        fontWeight={hoveredTrendIndex === i ? 'bold' : 'normal'}
                      >
                        {pt.displayDate}
                      </text>
                    </g>
                  ))}
                </svg>

                {/* Hover Tooltip */}
                {hoveredTrendIndex !== null && points[hoveredTrendIndex] && (
                  <div
                    className="absolute z-20 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2"
                    style={{
                      left: `${(points[hoveredTrendIndex].x / svgWidth) * 100}%`,
                      top: `${(points[hoveredTrendIndex].y / svgHeight) * 100}%`,
                    }}
                  >
                    <div className="font-bold text-emerald-400">
                      {formatCurrency(points[hoveredTrendIndex].amount, currency)}
                    </div>
                    <div className="text-[10px] text-slate-300">
                      {points[hoveredTrendIndex].date} ({points[hoveredTrendIndex].count} transactions)
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Category Donut Chart (1 Column) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              Category Breakdown
            </h3>
            <p className="text-xs text-slate-700">Distribution of expenditures by type</p>
          </div>

          {/* Donut graphic */}
          <div className="relative flex items-center justify-center my-3">
            <svg width="200" height="200" viewBox="0 0 200 200">
              {totalSpend === 0 ? (
                <circle
                  cx={centerCoord}
                  cy={centerCoord}
                  r={donutRadius}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth={donutStrokeWidth}
                />
              ) : (
                sortedCategories.map(([cat, amt]) => {
                  const percentage = amt / totalSpend;
                  const strokeDasharray = `${percentage * circumference} ${circumference}`;
                  const strokeDashoffset = -accumulatedAngle;
                  accumulatedAngle += percentage * circumference;
                  const color = CATEGORY_COLORS[cat] || '#94a3b8';
                  const isHovered = hoveredCategory === cat;

                  return (
                    <circle
                      key={cat}
                      cx={centerCoord}
                      cy={centerCoord}
                      r={donutRadius}
                      fill="none"
                      stroke={color}
                      strokeWidth={isHovered ? donutStrokeWidth + 4 : donutStrokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      transform={`rotate(-90 ${centerCoord} ${centerCoord})`}
                      className="transition-all duration-200 cursor-pointer"
                      onMouseEnter={() => setHoveredCategory(cat)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    />
                  );
                })
              )}
            </svg>

            {/* Donut Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">
                {hoveredCategory || 'Total Spend'}
              </span>
              <span className="text-lg font-black text-slate-900">
                {hoveredCategory
                  ? formatCurrency(categoryTotals[hoveredCategory] || 0, currency)
                  : formatCurrency(totalSpend, currency)}
              </span>
            </div>
          </div>

          {/* Category Legend */}
          <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-thin pr-1 text-xs">
            {sortedCategories.map(([cat, amt]) => {
              const pct = totalSpend > 0 ? ((amt / totalSpend) * 100).toFixed(0) : '0';
              const color = CATEGORY_COLORS[cat] || '#94a3b8';

              return (
                <div
                  key={cat}
                  onMouseEnter={() => setHoveredCategory(cat)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                    hoveredCategory === cat ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate text-slate-700">{cat}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-slate-900">{formatCurrency(amt, currency)}</span>
                    <span className="text-[10px] text-slate-700 font-mono w-7 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Contributor Comparison & Payment Mode Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contributor Spending Comparison */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Spending by Contributor
              </h3>
              <p className="text-xs text-slate-700">Track and compare expenses of each member</p>
            </div>
            <button
              onClick={onOpenAddExpense}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              Add Expense <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5">
            {sortedSpenders.map(([name, amt], idx) => {
              const pct = totalSpend > 0 ? Math.round((amt / totalSpend) * 100) : 0;

              return (
                <div key={name} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-800">{name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-extrabold text-slate-900">{formatCurrency(amt, currency)}</span>
                      <span className="text-slate-700 text-[11px] font-semibold">({pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Mode Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Payment Modes Utilized
              </h3>
              <p className="text-xs text-slate-700">Split by UPI / GPay, Cards, Cash, Net Banking</p>
            </div>
          </div>

          <div className="space-y-3">
            {sortedPaymentModes.map(([mode, data]) => {
              const pct = totalSpend > 0 ? Math.round((data.total / totalSpend) * 100) : 0;

              return (
                <div key={mode} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                      {mode.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-800">{mode}</div>
                      <div className="text-[11px] text-slate-700 font-medium">{data.count} transactions recorded</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-xs text-slate-900">{formatCurrency(data.total, currency)}</div>
                    <div className="text-[10px] text-emerald-800 font-bold font-mono">{pct}% of total</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
