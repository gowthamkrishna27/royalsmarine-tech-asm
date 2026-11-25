import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { reportApi, visitApi, followupApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import { downloadBlob } from '../../hooks/useApi';
import { ArrowDownTrayIcon, FunnelIcon, XMarkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
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

const TABS = ['visits', 'followups'];
const TAB_LABELS = { visits: 'Visits', followups: 'Follow-ups' };

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
  const availableTabs = useMemo(() => (isSalesExec ? ['visits'] : TABS), [isSalesExec]);

  const [tab, setTab] = useState('visits');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [region, setRegion] = useState('');
  const [asmId, setAsmId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [farmerId, setFarmerId] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  // 1. Unified metadata for filters (regions, ASMs, techs, farmers)
  const { data: filterMeta } = useQuery({
    queryKey: ['visit-filters'],
    queryFn: () => visitApi.getFilters().then((r) => r.data.data),
    staleTime: 60000,
  });

  // Region dropdown options
  const regionOptions = useMemo(() => {
    return (filterMeta?.regions || []).map((r) => ({
      value: r,
      label: r,
    }));
  }, [filterMeta?.regions]);

  // ASM dropdown options (filtered by selected Region)
  const asmOptions = useMemo(() => {
    const list = (filterMeta?.asms || []).filter((a) => (a.status ? a.status === 'active' : true));
    const filtered = region
      ? list.filter((a) => (a.region || '').toLowerCase() === region.toLowerCase())
      : list;
    return filtered.map((a) => ({
      value: String(a.id),
      label: a.name + (!region && a.region ? ` (${a.region})` : ''),
    }));
  }, [filterMeta?.asms, region]);

  // Technician dropdown options (filtered by selected ASM, or selected Region)
  const techOptions = useMemo(() => {
    let list = (filterMeta?.techs || []).filter((t) => (t.status ? t.status === 'active' : true));
    if (asmId) {
      list = list.filter((t) => String(t.manager_id) === String(asmId));
    } else if (region) {
      list = list.filter((t) => (t.region || '').toLowerCase() === region.toLowerCase());
    }
    return list.map((t) => ({
      value: String(t.id),
      label: t.name,
    }));
  }, [filterMeta?.techs, asmId, region]);

  // Farmer dropdown options (filtered by Tech, ASM, or Region)
  const farmerOptions = useMemo(() => {
    let list = filterMeta?.farmers || [];
    if (technicianId) {
      list = list.filter((f) => String(f.assigned_salesperson_id) === String(technicianId));
    } else if (asmId) {
      const techIdsUnderAsm = new Set(
        (filterMeta?.techs || [])
          .filter((t) => String(t.manager_id) === String(asmId))
          .map((t) => String(t.id))
      );
      list = list.filter(
        (f) =>
          String(f.assigned_manager_id) === String(asmId) ||
          techIdsUnderAsm.has(String(f.assigned_salesperson_id))
      );
    } else if (region) {
      list = list.filter((f) => (f.region || '').toLowerCase() === region.toLowerCase());
    }
    return list.map((f) => ({
      value: String(f.id),
      label: f.name,
    }));
  }, [filterMeta?.farmers, filterMeta?.techs, technicianId, asmId, region]);

  // Cascading Filter Handlers
  const handleRegionChange = (newRegion) => {
    setRegion(newRegion);
    setPage(1);
    if (asmId && newRegion) {
      const curAsm = (filterMeta?.asms || []).find((a) => String(a.id) === String(asmId));
      if (curAsm && (curAsm.region || '').toLowerCase() !== newRegion.toLowerCase()) {
        setAsmId('');
        setTechnicianId('');
        setFarmerId('');
      }
    }
  };

  const handleAsmChange = (newAsmId) => {
    setAsmId(newAsmId);
    setPage(1);
    if (technicianId && newAsmId) {
      const curTech = (filterMeta?.techs || []).find((t) => String(t.id) === String(technicianId));
      if (curTech && String(curTech.manager_id) !== String(newAsmId)) {
        setTechnicianId('');
        setFarmerId('');
      }
    }
  };

  const handleTechChange = (newTechId) => {
    setTechnicianId(newTechId);
    setPage(1);
    if (farmerId && newTechId) {
      const curFarmer = (filterMeta?.farmers || []).find((f) => String(f.id) === String(farmerId));
      if (curFarmer && String(curFarmer.assigned_salesperson_id) !== String(newTechId)) {
        setFarmerId('');
      }
    }
  };

  const handleFarmerChange = (newFarmerId) => {
    setFarmerId(newFarmerId);
    setPage(1);
  };

  const handleResetFilters = () => {
    setRegion('');
    setAsmId('');
    setTechnicianId('');
    setFarmerId('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    region || asmId || technicianId || farmerId || fromDate || toDate
  );

  // 2. Fetch Aggregated Visit Report
  const { data: visitReport, isLoading: visitLoading } = useQuery({
    queryKey: ['report-visits', fromDate, toDate, region, asmId, technicianId, farmerId],
    queryFn: () => reportApi.visits({
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      region: region || undefined,
      asm_id: asmId || undefined,
      technician_id: technicianId || undefined,
      salesperson_id: technicianId || undefined,
      farmer_id: farmerId || undefined,
    }).then(r => r.data.data || r.data),
    enabled: tab === 'visits',
  });

  // 3. Fetch Detailed Visit Records
  const { data: visitsResponse, isLoading: visitsRecordsLoading } = useQuery({
    queryKey: ['report-detailed-visits', fromDate, toDate, region, asmId, technicianId, farmerId, page],
    queryFn: () =>
      visitApi
        .list({
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          region: region || undefined,
          asm_id: asmId || undefined,
          tech_id: technicianId || undefined,
          salesperson_id: technicianId || undefined,
          farmer_id: farmerId || undefined,
          client_id: farmerId || undefined,
          page,
          limit: 10,
        })
        .then((r) => r.data),
    enabled: tab === 'visits',
  });

  const detailedVisits = visitsResponse?.data || [];
  const visitsMeta = visitsResponse?.pagination || visitsResponse?.meta;

  // 4. Fetch Aggregated Follow-up Report
  const { data: followupReport, isLoading: fuLoading } = useQuery({
    queryKey: ['report-followups', fromDate, toDate, region, asmId, technicianId, farmerId],
    queryFn: () => reportApi.followups({
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      region: region || undefined,
      asm_id: asmId || undefined,
      technician_id: technicianId || undefined,
      salesperson_id: technicianId || undefined,
      farmer_id: farmerId || undefined,
    }).then(r => r.data.data || r.data),
    enabled: tab === 'followups' && !isSalesExec,
  });

  // 5. Fetch Detailed Follow-up Records
  const { data: followupsResponse, isLoading: followupsRecordsLoading } = useQuery({
    queryKey: ['report-detailed-followups', fromDate, toDate, region, asmId, technicianId, farmerId, page],
    queryFn: () =>
      followupApi
        .list({
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          region: region || undefined,
          asm_id: asmId || undefined,
          tech_id: technicianId || undefined,
          salesperson_id: technicianId || undefined,
          farmer_id: farmerId || undefined,
          client_id: farmerId || undefined,
          page,
          limit: 10,
        })
        .then((r) => r.data),
    enabled: tab === 'followups' && !isSalesExec,
  });

  const detailedFollowups = followupsResponse?.data || [];
  const followupsMeta = followupsResponse?.pagination || followupsResponse?.meta;

  // 6. Handle Export Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {
        type: tab,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        region: region || undefined,
        asm_id: asmId || undefined,
        technician_id: technicianId || undefined,
        salesperson_id: technicianId || undefined,
        farmer_id: farmerId || undefined,
      };
      const res = await reportApi.export(params);

      let filename = `${tab}-report.xlsx`;
      if (farmerId) {
        const f = farmerOptions.find(o => o.value === farmerId);
        if (f) filename = `${f.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_report.xlsx`;
      } else if (technicianId) {
        const t = techOptions.find(o => o.value === technicianId);
        if (t) filename = `${t.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_technician_report.xlsx`;
      } else if (asmId) {
        const a = asmOptions.find(o => o.value === asmId);
        if (a) filename = `${a.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_asm_report.xlsx`;
      }

      downloadBlob(res.data, filename);
      toast.success('Report downloaded successfully');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
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
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-secondary btn-sm inline-flex items-center gap-1.5 transition disabled:opacity-50"
        >
          <ArrowDownTrayIcon className="w-4 h-4 text-gray-500" />
          <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
        </button>
      </div>

      {/* Tabs */}
      {availableTabs.length > 1 && (
        <div className="w-full">
          <div className="grid grid-cols-2 bg-gray-100 p-1 rounded-xl w-full sm:w-fit sm:flex gap-1">
            {availableTabs.map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setPage(1); }}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg text-center truncate capitalize transition ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters - Responsive Grid */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <FunnelIcon className="w-3.5 h-3.5 text-gray-400" />
            <span>Filter Report Data</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {!isSalesExec && (
            <select
              value={region}
              onChange={e => handleRegionChange(e.target.value)}
              className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-gray-400 text-gray-700 w-full"
            >
              <option value="">All Regions</option>
              {regionOptions.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          )}

          {!isSalesExec && (
            <select
              value={asmId}
              onChange={e => handleAsmChange(e.target.value)}
              className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-gray-400 text-gray-700 w-full"
            >
              <option value="">All ASMs</option>
              {asmOptions.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          )}

          {!isSalesExec && (
            <select
              value={technicianId}
              onChange={e => handleTechChange(e.target.value)}
              className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-gray-400 text-gray-700 w-full"
            >
              <option value="">All Technicians</option>
              {techOptions.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          )}

          {!isSalesExec && (
            <select
              value={farmerId}
              onChange={e => handleFarmerChange(e.target.value)}
              className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-gray-400 text-gray-700 w-full"
            >
              <option value="">All Farmers</option>
              {farmerOptions.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          )}

          {isSalesExec && (
            <div className="col-span-2 sm:col-span-2 flex items-center gap-1.5 px-3 py-2 bg-blue-50/70 border border-blue-100 rounded-lg text-xs text-blue-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
              <span className="truncate">My Reports: <strong>{user?.full_name}</strong></span>
            </div>
          )}

          <div className="col-span-1">
            <input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setPage(1); }}
              className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-gray-400 text-gray-700 w-full"
              placeholder="From Date"
            />
          </div>

          <div className="col-span-1">
            <input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setPage(1); }}
              className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-gray-400 text-gray-700 w-full"
              placeholder="To Date"
            />
          </div>
        </div>
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
                {!isSalesExec && (
                  <>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                      <p className="text-xs text-gray-500 font-medium">Top Performer</p>
                      <p className="text-base sm:text-lg font-bold text-blue-600 mt-1 truncate">{visitSummary.topPerson}</p>
                      <p className="text-[11px] text-gray-400">{visitSummary.topCount} visits logged</p>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
                      <p className="text-xs text-gray-500 font-medium">Active Personnel</p>
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
                      {visitChartType === 'pie' ? 'Visit Share by Technical Executive' : 'Visits by Technical Executive'}
                    </h4>
                    <span className="text-[11px] text-gray-400">Field Performance Analysis</span>
                  </div>
                  <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setVisitChartType('pie')}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${visitChartType === 'pie' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                        }`}
                    >
                      Pie Share
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisitChartType('bar')}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${visitChartType === 'bar' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
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

                {/* Bar Chart View */}
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

            {/* Performance Breakdown by Technical Executive */}
            <div className="card overflow-hidden">
              <div className="card-header flex items-center justify-between">
                <h3 className="font-semibold text-sm">{isSalesExec ? 'My Performance Record' : 'Technical Executive Breakdown'}</h3>
                <span className="text-xs text-gray-400">{isSalesExec ? `${visitReport?.[0]?.total_visits || 0} Visits` : `${visitReport?.length || 0} Reps`}</span>
              </div>
              <div className="w-full">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="py-2.5">Technical Executive</th>
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
                    {!visitReport?.length && <tr><td colSpan={2} className="text-center text-gray-400 py-8">No visit data found for the selected filters</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed Visit Records Table (According to applied filters) */}
            <div className="card overflow-hidden">
              <div className="card-header flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Detailed Visit Records</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Visits matching the above applied filters</p>
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  {visitsMeta?.total ?? detailedVisits.length} Records
                </span>
              </div>

              {visitsRecordsLoading ? (
                <div className="py-12">
                  <PageSpinner />
                </div>
              ) : detailedVisits.length === 0 ? (
                <div className="text-center text-gray-400 py-10 text-xs">
                  No detailed visit records found for the applied filters.
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="table w-full text-xs">
                    <thead>
                      <tr>
                        <th className="py-2.5">Date</th>
                        <th className="py-2.5">Farmer</th>
                        <th className="py-2.5">Tank / Pond</th>
                        <th className="py-2.5">Meeting Type</th>
                        <th className="py-2.5">Technical Executive</th>
                        <th className="py-2.5">City / Area</th>
                        <th className="py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detailedVisits.map((v) => (
                        <tr key={v.id} className="hover:bg-gray-50/70 transition">
                          <td className="py-2.5 font-mono text-gray-600">
                            {v.visit_date}
                          </td>
                          <td className="py-2.5 font-medium text-gray-900">
                            <Link
                              to={`/clients/${v.client_id}`}
                              className="hover:text-blue-600 truncate block max-w-[180px]"
                            >
                              {v.company_name || v.contact_person || `Farmer #${v.client_id}`}
                            </Link>
                          </td>
                          <td className="py-2.5 text-gray-600">
                            {v.tank_number || '—'}
                          </td>
                          <td className="py-2.5">
                            <span className="capitalize px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px] font-medium">
                              {(v.meeting_type || '—').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 text-gray-800 font-medium">
                            {v.salesperson_name || '—'}
                          </td>
                          <td className="py-2.5 text-gray-500">
                            {v.city || '—'}
                          </td>
                          <td className="py-2.5 text-right">
                            <Link
                              to={`/visits/${v.id}`}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                            >
                              <span>View</span>
                              <ArrowTopRightOnSquareIcon className="w-3 h-3 text-gray-400" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {visitsMeta && visitsMeta.totalPages > 1 && (
                <div className="p-3 border-t border-gray-100">
                  <Pagination
                    currentPage={visitsMeta.page}
                    totalPages={visitsMeta.totalPages}
                    onPageChange={(p) => setPage(p)}
                  />
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* 2. FOLLOW-UPS TAB */}
      {tab === 'followups' && !isSalesExec && (
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

            {/* Donut & Status Distribution Chart */}
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

            {/* Follow-up Summary by Rep */}
            <div className="card overflow-hidden">
              <div className="card-header flex items-center justify-between">
                <h3 className="font-semibold text-sm">{isSalesExec ? 'My Follow-up Tasks' : 'Follow-up Summary by Rep'}</h3>
                <span className="text-xs text-gray-400">{isSalesExec ? `${followupSummary?.total || 0} Tasks` : `${followupReport?.length || 0} Reps`}</span>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Technical Executive</th>
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
                      <tr><td colSpan={5} className="text-center text-gray-400 py-8">No follow-up summary found for the selected filters</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed Follow-up Records Table (According to applied filters) */}
            <div className="card overflow-hidden">
              <div className="card-header flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Detailed Follow-up Records</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Tasks matching the above applied filters</p>
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  {followupsMeta?.total ?? detailedFollowups.length} Records
                </span>
              </div>

              {followupsRecordsLoading ? (
                <div className="py-12">
                  <PageSpinner />
                </div>
              ) : detailedFollowups.length === 0 ? (
                <div className="text-center text-gray-400 py-10 text-xs">
                  No detailed follow-up records found for the applied filters.
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="table w-full text-xs">
                    <thead>
                      <tr>
                        <th className="py-2.5">Due Date</th>
                        <th className="py-2.5">Farmer</th>
                        <th className="py-2.5">Title</th>
                        <th className="py-2.5">Technical Executive</th>
                        <th className="py-2.5">Done By</th>
                        <th className="py-2.5">Priority</th>
                        <th className="py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detailedFollowups.map((f) => {
                        const isCompleted = String(f.status || '').toLowerCase() === 'completed' || Boolean(f.completed_date);
                        const noteMatch = typeof f.completion_notes === 'string' && f.completion_notes.match(/completed by ([^,\n\r]+)/i);
                        const extractedNoteUser = noteMatch ? noteMatch[1].trim() : null;
                        const doneByUser = f.completed_by_name || (isCompleted ? (extractedNoteUser || f.salesperson_name || f.assigned_salesperson_name) : null);
                        return (
                          <tr key={f.id} className="hover:bg-gray-50/70 transition">
                            <td className="py-2.5 font-mono text-gray-600">
                              {f.followup_date || '—'}
                            </td>
                            <td className="py-2.5 font-medium text-gray-900">
                              {f.company_name || f.client_name || `Farmer #${f.client_id}`}
                            </td>
                            <td className="py-2.5 text-gray-700">
                              {f.title || '—'}
                            </td>
                            <td className="py-2.5 text-gray-800 font-medium">
                              {f.assigned_salesperson_name || f.salesperson_name || '—'}
                            </td>
                            <td className="py-2.5 text-gray-800">
                              {doneByUser ? (
                                <span className="font-medium text-emerald-700">
                                  {doneByUser}
                                </span>
                              ) : isCompleted ? (
                                <span className="font-medium text-emerald-700">
                                  {f.salesperson_name || 'Completed'}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 capitalize text-gray-500">
                              {f.priority || 'medium'}
                            </td>
                            <td className="py-2.5 text-right">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${isCompleted
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : String(f.status || '').toLowerCase() === 'overdue'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                              >
                                {f.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {followupsMeta && followupsMeta.totalPages > 1 && (
                <div className="p-3 border-t border-gray-100">
                  <Pagination
                    currentPage={followupsMeta.page}
                    totalPages={followupsMeta.totalPages}
                    onPageChange={(p) => setPage(p)}
                  />
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
