import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportApi, userApi, masterApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageSpinner } from '../../components/common/Spinner';
import { downloadBlob } from '../../hooks/useApi';
import { ArrowDownTrayIcon, UserIcon } from '@heroicons/react/24/outline';
import Badge from '../../components/common/Badge';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const TABS = ['visits', 'followups', 'brand'];
const TAB_LABELS = { visits: 'Visits', followups: 'Follow-ups', brand: 'Brand Visits' };

const BRAND_COLORS = [
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#64748b',
];

const FOLLOWUP_COLORS = {
  Completed: '#10b981',
  Pending: '#f59e0b',
  Overdue: '#ef4444',
};

// Minimal Custom Tooltip
const MinimalTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-lg border border-gray-100 text-xs">
        <p className="font-semibold text-gray-800">{label || item.name}</p>
        <p className="font-bold text-blue-600 mt-0.5">
          {item.value} {item.unit || ''}
        </p>
      </div>
    );
  }
  return null;
};

// Minimal Pie Tooltip
const MinimalPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-lg border border-gray-100 text-xs">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: data.payload.fill }}
          />
          <span className="font-semibold text-gray-800">{data.name}:</span>
          <span className="font-bold text-gray-900">{data.value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function Reports() {
  const { user } = useAuth();
  const isSalesExec = user?.role === 'sales_executive';

  const [tab, setTab] = useState('visits');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [salespersonId, setSalespersonId] = useState('');
  const [brandId, setBrandId] = useState('');

  const { data: salespeople } = useQuery({
    queryKey: ['salespeople'],
    queryFn: () => userApi.list({ role: 'sales_executive' }).then(r => r.data.data),
    enabled: !isSalesExec,
  });
  const { data: brands } = useQuery({
    queryKey: ['brands-list'],
    queryFn: () => masterApi.brands({ status: 'active' }).then(r => r.data.data),
  });

  const { data: visitReport, isLoading: visitLoading } = useQuery({
    queryKey: ['report-visits', fromDate, toDate, salespersonId],
    queryFn: () => reportApi.visits({ from_date: fromDate, to_date: toDate, salesperson_id: salespersonId }).then(r => r.data.data),
    enabled: tab === 'visits',
  });

  const { data: followupReport, isLoading: fuLoading } = useQuery({
    queryKey: ['report-followups', fromDate, toDate, salespersonId],
    queryFn: () => reportApi.followups({ from_date: fromDate, to_date: toDate, salesperson_id: salespersonId }).then(r => r.data.data),
    enabled: tab === 'followups',
  });

  const { data: brandReport, isLoading: brandLoading } = useQuery({
    queryKey: ['report-brand', fromDate, toDate, brandId],
    queryFn: () => reportApi.brand({ from_date: fromDate, to_date: toDate, brand_id: brandId }).then(r => r.data.data),
    enabled: tab === 'brand',
  });

  const handleExport = async () => {
    try {
      const res = await reportApi.export({ type: tab, from_date: fromDate, to_date: toDate });
      downloadBlob(res.data, `${tab}-report.xlsx`);
    } catch {
      toast.error('Export failed');
    }
  };

  // Follow-up totals & pie data
  const followupSummary = useMemo(() => {
    if (!followupReport?.length) return null;
    let completed = 0, overdue = 0, pending = 0, total = 0;
    followupReport.forEach(r => {
      completed += Number(r.completed || 0);
      overdue += Number(r.overdue || 0);
      pending += Number(r.pending || 0);
      total += Number(r.total || 0);
    });
    const pieData = [
      { name: 'Completed', value: completed, fill: FOLLOWUP_COLORS.Completed },
      { name: 'Pending', value: pending, fill: FOLLOWUP_COLORS.Pending },
      { name: 'Overdue', value: overdue, fill: FOLLOWUP_COLORS.Overdue },
    ].filter(d => d.value > 0);
    return { completed, overdue, pending, total, pieData };
  }, [followupReport]);

  // Brand summary & pie data
  const brandSummary = useMemo(() => {
    if (!brandReport?.length) return null;
    const total = brandReport.reduce((acc, b) => acc + Number(b.total_visits || 0), 0);
    const topBrand = brandReport[0]?.brand_name || 'N/A';
    const pieData = brandReport
      .filter(b => Number(b.total_visits) > 0)
      .slice(0, 7)
      .map((b, idx) => ({
        name: b.brand_name || 'Untagged',
        value: Number(b.total_visits),
        fill: BRAND_COLORS[idx % BRAND_COLORS.length],
      }));
    return { total, topBrand, pieData };
  }, [brandReport]);

  // Visit summary with pie data
  const [visitChartType, setVisitChartType] = useState('pie'); // 'pie' or 'bar'
  const visitSummary = useMemo(() => {
    if (!visitReport?.length) return null;
    const total = visitReport.reduce((acc, r) => acc + Number(r.total_visits || 0), 0);
    const topPerson = visitReport[0]?.salesperson || 'N/A';
    const topCount = Number(visitReport[0]?.total_visits || 0);
    const avgVisits = total > 0 ? (total / visitReport.length).toFixed(1) : 0;
    
    const chartData = visitReport.map(r => ({
      name: r.salesperson?.split(' ')[0] || r.salesperson,
      fullName: r.salesperson,
      visits: Number(r.total_visits || 0),
    }));

    const pieData = visitReport
      .filter(r => Number(r.total_visits) > 0)
      .map((r, idx) => ({
        name: r.salesperson,
        value: Number(r.total_visits),
        percentage: total > 0 ? Math.round((Number(r.total_visits) / total) * 100) : 0,
        fill: BRAND_COLORS[idx % BRAND_COLORS.length],
      }));

    return { total, topPerson, topCount, avgVisits, chartData, pieData };
  }, [visitReport]);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <button onClick={handleExport} className="btn-secondary btn-sm">
          <ArrowDownTrayIcon className="w-4 h-4" /> Export Excel
        </button>
      </div>

      {/* Tabs - No horizontal scrolling */}
      <div className="w-full">
        <div className="grid grid-cols-3 bg-gray-100 p-1 rounded-xl w-full sm:w-fit sm:flex gap-1">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg text-center truncate capitalize transition ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Filters - Responsive Grid, No Overflow */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5">
        {!isSalesExec && tab !== 'brand' && (
          <select
            value={salespersonId}
            onChange={e => setSalespersonId(e.target.value)}
            className="input text-xs sm:text-sm col-span-2 sm:col-span-1 sm:w-auto"
          >
            <option value="">All Salespeople</option>
            {salespeople?.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        )}
        {isSalesExec && (
          <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5 px-3 py-2 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
            <span className="truncate">My Reports: <strong>{user?.full_name}</strong></span>
          </div>
        )}
        {tab === 'brand' && (
          <select
            value={brandId}
            onChange={e => setBrandId(e.target.value)}
            className="input text-xs sm:text-sm col-span-2 sm:col-span-1 sm:w-auto"
          >
            <option value="">All Brands</option>
            {brands?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          className="input text-xs sm:text-sm w-full sm:w-auto"
        />
        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          className="input text-xs sm:text-sm w-full sm:w-auto"
        />
      </div>

      {/* 1. VISITS TAB */}
      {tab === 'visits' && (
        visitLoading ? <PageSpinner /> : (
          <div className="space-y-4">
            {/* Minimal KPI Highlights */}
            {visitSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                  <p className="text-xs text-gray-500 font-medium">{isSalesExec ? 'My Field Visits' : 'Total Field Visits'}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{visitSummary.total}</p>
                </div>
                {isSalesExec ? (
                  <>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                      <p className="text-xs text-gray-500 font-medium">Top Brand Logged</p>
                      <p className="text-base sm:text-lg font-bold text-blue-600 mt-1 truncate">{brandSummary?.topBrand || 'N/A'}</p>
                      <p className="text-[11px] text-gray-400">Most visited brand</p>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                      <p className="text-xs text-gray-500 font-medium">Completed Follow-ups</p>
                      <p className="text-2xl font-bold text-emerald-600 mt-1">{followupSummary?.completed || 0}</p>
                      <p className="text-[11px] text-gray-400">Closed tasks</p>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                      <p className="text-xs text-gray-500 font-medium">Pending Follow-ups</p>
                      <p className="text-2xl font-bold text-amber-600 mt-1">{followupSummary?.pending || 0}</p>
                      <p className="text-[11px] text-gray-400">Open action items</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                      <p className="text-xs text-gray-500 font-medium">Top Performer</p>
                      <p className="text-base sm:text-lg font-bold text-blue-600 mt-1 truncate">{visitSummary.topPerson}</p>
                      <p className="text-[11px] text-gray-400">{visitSummary.topCount} visits logged</p>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                      <p className="text-xs text-gray-500 font-medium">Active Sales Reps</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{visitReport?.length || 0}</p>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                      <p className="text-xs text-gray-500 font-medium">Avg / Rep</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{visitSummary.avgVisits}</p>
                      <p className="text-[11px] text-gray-400">visits per rep</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Minimal Visualization Card with Pie & Bar Toggle */}
            {visitSummary && (visitSummary.pieData?.length > 0 || visitSummary.chartData?.length > 0) && (
              <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {visitChartType === 'pie' ? 'Visit Share by Salesperson' : 'Visits by Salesperson'}
                    </h4>
                    <span className="text-[11px] text-gray-400">Field Performance Analysis</span>
                  </div>
                  {/* Subtle View Switcher */}
                  <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setVisitChartType('pie')}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        visitChartType === 'pie' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Pie Share
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisitChartType('bar')}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        visitChartType === 'bar' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Bar Trend
                    </button>
                  </div>
                </div>

                {/* Pie / Donut Chart View */}
                {visitChartType === 'pie' && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                    <div className="h-44 w-44 relative flex items-center justify-center flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip content={<MinimalPieTooltip />} />
                          <Pie
                            data={visitSummary.pieData}
                            innerRadius={50}
                            outerRadius={74}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {visitSummary.pieData.map((entry, index) => (
                              <Cell key={`visit-pie-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center pointer-events-none">
                        <p className="text-[11px] text-gray-400 font-medium">Visits</p>
                        <p className="text-lg font-bold text-gray-900">{visitSummary.total}</p>
                      </div>
                    </div>

                    {/* Clean Minimal Legend */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 w-full sm:w-auto text-xs">
                      {visitSummary.pieData.map(item => (
                        <div key={item.name} className="flex items-center justify-between gap-3 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }} />
                            <span className="font-medium text-gray-700 truncate max-w-[110px]">{item.name}</span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="font-bold text-gray-900">{item.value}</span>
                            <span className="text-[10px] text-gray-400 ml-1">({item.percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Minimal Bar Chart View */}
                {visitChartType === 'bar' && (
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={visitSummary.chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip content={<MinimalTooltip />} cursor={{ fill: '#f3f4f6', radius: 4 }} />
                        <Bar dataKey="visits" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Detailed Table - 100% responsive, Zero horizontal scroll */}
            <div className="card overflow-hidden">
              <div className="card-header flex items-center justify-between">
                <h3 className="font-semibold text-sm">{isSalesExec ? 'My Performance Record' : 'Salesperson Breakdown'}</h3>
                <span className="text-xs text-gray-400">{isSalesExec ? `${visitReport?.[0]?.total_visits || 0} Visits` : `${visitReport?.length || 0} Reps`}</span>
              </div>
              <div className="w-full">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="py-2.5">Salesperson</th>
                      <th className="py-2.5 text-right">Total Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitReport?.map((r, idx) => {
                      const count = Number(r.total_visits || 0);
                      const maxCount = visitSummary?.topCount || 1;
                      const percent = Math.round((count / (visitSummary?.total || 1)) * 100);
                      const relativeBar = Math.round((count / maxCount) * 100);
                      const color = BRAND_COLORS[idx % BRAND_COLORS.length];
                      return (
                        <tr key={r.salesperson}>
                          <td className="font-medium text-gray-900 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                              <span className="truncate">{r.salesperson}</span>
                            </div>
                            {/* Inline Micro Share Bar - No extra columns needed */}
                            <div className="flex items-center gap-2 mt-1 pl-4 max-w-[180px] sm:max-w-xs">
                              <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                                <div
                                  className="h-1 rounded-full transition-all duration-500"
                                  style={{ width: `${relativeBar}%`, backgroundColor: color }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-400 font-medium flex-shrink-0">
                                {percent}%
                              </span>
                            </div>
                          </td>
                          <td className="text-right py-3 align-middle">
                            <Badge color="blue">{count}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {!visitReport?.length && <tr><td colSpan={2} className="text-center text-gray-400 py-8">No visit data found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* 2. FOLLOW-UPS TAB */}
      {tab === 'followups' && (
        fuLoading ? <PageSpinner /> : (
          <div className="space-y-4">
            {/* Minimal KPI Highlights */}
            {followupSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                  <p className="text-xs text-gray-500 font-medium">Total Follow-ups</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{followupSummary.total}</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                  <p className="text-xs text-emerald-600 font-medium">Completed</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{followupSummary.completed}</p>
                  <p className="text-[11px] text-gray-400">{followupSummary.total > 0 ? `${((followupSummary.completed / followupSummary.total) * 100).toFixed(0)}% completion rate` : ''}</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                  <p className="text-xs text-amber-600 font-medium">Pending</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{followupSummary.pending}</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                  <p className="text-xs text-red-600 font-medium">Overdue</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{followupSummary.overdue}</p>
                </div>
              </div>
            )}

            {/* Minimal Donut & Status Distribution Chart */}
            {followupSummary?.pieData?.length > 0 && (
              <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Status Distribution</h4>
                  <span className="text-[11px] text-gray-400">{followupSummary.total} Total</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                  <div className="h-40 w-40 relative flex items-center justify-center flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<MinimalPieTooltip />} />
                        <Pie
                          data={followupSummary.pieData}
                          innerRadius={46}
                          outerRadius={68}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {followupSummary.pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute text-center pointer-events-none">
                      <p className="text-xs text-gray-400 font-medium">Total</p>
                      <p className="text-base font-bold text-gray-900">{followupSummary.total}</p>
                    </div>
                  </div>

                  {/* Clean Minimal Legend */}
                  <div className="grid grid-cols-3 sm:grid-cols-1 gap-2 w-full sm:w-auto text-xs">
                    {followupSummary.pieData.map(item => (
                      <div key={item.name} className="flex items-center justify-between gap-3 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                          <span className="font-medium text-gray-700">{item.name}</span>
                        </div>
                        <span className="font-bold text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Follow-up Summary - Adaptive: Card list on mobile, Table on desktop (No horizontal scroll) */}
            <div className="card overflow-hidden">
              <div className="card-header flex items-center justify-between">
                <h3 className="font-semibold text-sm">{isSalesExec ? 'My Follow-up Tasks' : 'Follow-up Summary by Rep'}</h3>
                <span className="text-xs text-gray-400">{isSalesExec ? `${followupSummary?.total || 0} Tasks` : `${followupReport?.length || 0} Reps`}</span>
              </div>

              {/* Mobile View: zero horizontal scroll */}
              <div className="sm:hidden divide-y divide-gray-100">
                {followupReport?.map(r => (
                  <div key={r.salesperson} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm truncate">{r.salesperson}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          {r.completed} completed
                        </span>
                        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          {r.pending} pending
                        </span>
                        {Number(r.overdue) > 0 && (
                          <span className="text-[11px] font-medium text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                            {r.overdue} overdue
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge color="blue">{r.total} total</Badge>
                    </div>
                  </div>
                ))}
                {!followupReport?.length && (
                  <div className="text-center text-gray-400 py-8">No follow-up data found</div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block w-full">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Salesperson</th>
                      <th>Total</th>
                      <th>Completed</th>
                      <th>Overdue</th>
                      <th>Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {followupReport?.map(r => (
                      <tr key={r.salesperson}>
                        <td className="font-medium text-gray-900">{r.salesperson}</td>
                        <td className="font-bold">{r.total}</td>
                        <td><Badge color="green">{r.completed}</Badge></td>
                        <td><Badge color="red">{r.overdue}</Badge></td>
                        <td><Badge color="yellow">{r.pending}</Badge></td>
                      </tr>
                    ))}
                    {!followupReport?.length && (
                      <tr><td colSpan={5} className="text-center text-gray-400 py-8">No follow-up data found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* 3. BRAND VISITS TAB */}
      {tab === 'brand' && (
        brandLoading ? <PageSpinner /> : (
          <div className="space-y-4">
            {/* Minimal KPI Highlights */}
            {brandSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                  <p className="text-xs text-gray-500 font-medium">Total Brand Visits</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{brandSummary.total}</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                  <p className="text-xs text-gray-500 font-medium">Leading Brand</p>
                  <p className="text-lg font-bold text-purple-600 mt-1 truncate">{brandSummary.topBrand}</p>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                  <p className="text-xs text-gray-500 font-medium">Tracked Brands</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{brandReport?.length || 0}</p>
                </div>
              </div>
            )}

            {/* Minimal Brand Share Pie / Donut Chart */}
            {brandSummary?.pieData?.length > 0 && (
              <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Brand Share Distribution</h4>
                  <span className="text-[11px] text-gray-400">By Field Visits</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                  <div className="h-40 w-40 relative flex items-center justify-center flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<MinimalPieTooltip />} />
                        <Pie
                          data={brandSummary.pieData}
                          innerRadius={46}
                          outerRadius={68}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {brandSummary.pieData.map((entry, index) => (
                            <Cell key={`brand-cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute text-center pointer-events-none">
                      <p className="text-xs text-gray-400 font-medium">Visits</p>
                      <p className="text-base font-bold text-gray-900">{brandSummary.total}</p>
                    </div>
                  </div>

                  {/* Clean Minimal Brand Legend */}
                  <div className="grid grid-cols-2 gap-2 w-full sm:w-auto text-xs">
                    {brandSummary.pieData.map(item => (
                      <div key={item.name} className="flex items-center justify-between gap-3 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                          <span className="font-medium text-gray-700 truncate max-w-[100px]">{item.name}</span>
                        </div>
                        <span className="font-bold text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Table - Zero horizontal scroll */}
            <div className="card overflow-hidden">
              <div className="card-header flex items-center justify-between">
                <h3 className="font-semibold text-sm">{isSalesExec ? 'My Brand Visits' : 'Brand Field Visits'}</h3>
                <span className="text-xs text-gray-400">{brandReport?.length || 0} Brands</span>
              </div>
              <div className="w-full">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="py-2.5">Brand Name</th>
                      <th className="py-2.5 text-right">Total Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandReport?.map((r, idx) => {
                      const count = Number(r.total_visits || 0);
                      const maxCount = Number(brandReport[0]?.total_visits || 1);
                      const percent = Math.round((count / (brandSummary?.total || 1)) * 100);
                      const relativeBar = Math.round((count / maxCount) * 100);
                      const color = BRAND_COLORS[idx % BRAND_COLORS.length];
                      return (
                        <tr key={r.brand_id || r.brand_name || idx}>
                          <td className="font-semibold text-gray-900 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                              <span className="truncate">{r.brand_name || 'Untagged'}</span>
                            </div>
                            {/* Inline Micro Share Bar */}
                            <div className="flex items-center gap-2 mt-1 pl-4 max-w-[180px] sm:max-w-xs">
                              <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                                <div
                                  className="h-1 rounded-full transition-all duration-500"
                                  style={{ width: `${relativeBar}%`, backgroundColor: color }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-400 font-medium flex-shrink-0">
                                {percent}%
                              </span>
                            </div>
                          </td>
                          <td className="text-right py-3 align-middle">
                            <Badge color="blue">{count}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {!brandReport?.length && <tr><td colSpan={2} className="text-center text-gray-400 py-8">No brand visit data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
