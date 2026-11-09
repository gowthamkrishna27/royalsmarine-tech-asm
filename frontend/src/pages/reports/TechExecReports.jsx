import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { clientApi, reportApi } from '../../services/api';
import { downloadBlob } from '../../hooks/useApi';
import { PageSpinner } from '../../components/common/Spinner';
import {
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  CalendarDaysIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#64748b'];

export default function TechExecReports() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exporting, setExporting] = useState(false);

  // Fetch farmers assigned to this TE
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['te-clients'],
    queryFn: () => clientApi.list({ limit: 500 }).then((r) => r.data.data),
  });

  // Fetch visits report (scoped to this TE automatically by backend)
  const { data: visitReport, isLoading: visitLoading } = useQuery({
    queryKey: ['te-visit-report', fromDate, toDate],
    queryFn: () =>
      reportApi.visits({ from_date: fromDate, to_date: toDate }).then((r) => r.data.data),
  });

  // Build per-farmer rows
  const farmerRows = useMemo(() => {
    if (!clients?.length) return [];
    return clients.map((c) => ({
      id: c.id,
      name: c.company_name || c.name || 'Unknown Farmer',
      village: c.village || c.city || '',
      mobile: c.mobile || '',
      visits: 0,
    }));
  }, [clients]);

  // Merge visit counts into farmer rows
  const enrichedRows = useMemo(() => {
    if (!farmerRows.length) return [];
    if (!visitReport?.length) return farmerRows;

    const visitMap = {};
    visitReport.forEach((v) => {
      const key = (v.company_name || v.client_name || '').toLowerCase();
      if (key) visitMap[key] = (visitMap[key] || 0) + Number(v.total_visits || 1);
    });

    return farmerRows.map((row) => ({
      ...row,
      visits: visitMap[row.name.toLowerCase()] ?? 0,
    }));
  }, [farmerRows, visitReport]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return enrichedRows;
    const q = search.toLowerCase();
    return enrichedRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.village.toLowerCase().includes(q) ||
        r.mobile.includes(q),
    );
  }, [enrichedRows, search]);

  const totalFarmers = enrichedRows.length;
  const totalVisits = enrichedRows.reduce((s, r) => s + r.visits, 0);
  const visitedFarmers = enrichedRows.filter((r) => r.visits > 0).length;

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await reportApi.export({
        type: 'visits',
        from_date: fromDate,
        to_date: toDate,
      });
      downloadBlob(res.data, `farmer-reports.xlsx`);
      toast.success('Report exported!');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const isLoading = clientsLoading || visitLoading;

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 transition shrink-0 active:scale-95"
          aria-label="Back to dashboard"
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-gray-900 leading-tight">My Farmer Reports</h1>
          <p className="text-xs text-gray-500 truncate">
            Visit activity for farmers under {user?.full_name}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition disabled:opacity-60 shrink-0"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          <span>{exporting ? 'Exporting…' : 'Export'}</span>
        </button>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-3 text-center">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-1.5">
            <BuildingOfficeIcon className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{totalFarmers}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">My Farmers</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-3 text-center">
          <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-1.5">
            <MapPinIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{totalVisits}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">Total Visits</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-3 text-center">
          <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-1.5">
            <ChartBarIcon className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{visitedFarmers}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">Visited</p>
        </div>
      </div>

      {/* Date Filters */}
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <CalendarDaysIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="input pl-9 text-xs w-full"
          />
        </div>
        <div className="relative">
          <CalendarDaysIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="input pl-9 text-xs w-full"
          />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search farmer, village, mobile…"
          className="input pl-9 text-sm w-full"
        />
      </div>

      {/* Farmer Cards List */}
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="space-y-2.5">
          {/* Result count + clear dates */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-gray-400 font-medium">
              {filtered.length} farmer{filtered.length !== 1 ? 's' : ''}
              {search ? ` matching "${search}"` : ''}
            </p>
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="text-xs text-blue-600 font-medium hover:underline"
              >
                Clear dates
              </button>
            )}
          </div>

          {filtered.length === 0 && (
            <div className="card py-12 text-center space-y-2">
              <BuildingOfficeIcon className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="text-sm font-semibold text-gray-500">No farmers found</p>
              <p className="text-xs text-gray-400">
                {search ? 'Try a different search term.' : 'No farmers are assigned to you yet.'}
              </p>
            </div>
          )}

          {filtered.map((row, idx) => {
            const color = COLORS[idx % COLORS.length];
            const hasVisits = row.visits > 0;
            const maxVisits = Math.max(...filtered.map((r) => r.visits), 1);
            const barPct = Math.round((row.visits / maxVisits) * 100);

            return (
              <div
                key={row.id}
                className="bg-white rounded-2xl border border-gray-200/70 shadow-xs p-4 flex items-center gap-3 active:scale-[0.99] transition"
              >
                {/* Avatar initial */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {row.name.charAt(0).toUpperCase()}
                </div>

                {/* Info + mini bar */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{row.name}</p>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    {row.village || row.mobile || '—'}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${barPct}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-400 font-medium shrink-0">
                      {row.visits} visit{row.visits !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Visit count badge */}
                <div className="shrink-0 text-center">
                  <span
                    className={`inline-flex items-center justify-center min-w-[36px] px-2 py-1 rounded-xl text-xs font-bold ${
                      hasVisits ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {row.visits}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-0.5">visits</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
