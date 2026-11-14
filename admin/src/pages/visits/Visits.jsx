import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { visitApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { MapPinIcon, ArrowDownTrayIcon, CalendarDaysIcon, XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { MEETING_TYPES } from '../../constants';
import { downloadBlob } from '../../hooks/useApi';
import toast from 'react-hot-toast';

export default function Visits() {
  const [page, setPage] = useState(1);
  const [region, setRegion] = useState('');
  const [asmId, setAsmId] = useState('');
  const [techId, setTechId] = useState('');
  const [farmerId, setFarmerId] = useState('');
  const [meetingType, setMeetingType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Fetch filter metadata (regions, ASMs, techs, farmers)
  const { data: filterMeta } = useQuery({
    queryKey: ['visit-filters'],
    queryFn: () => visitApi.getFilters().then((r) => r.data.data),
    staleTime: 60000,
  });

  // 1. Region dropdown options
  const regionOptions = useMemo(() => {
    return (filterMeta?.regions || []).map((r) => ({
      value: r,
      label: r,
    }));
  }, [filterMeta?.regions]);

  // 2. ASM dropdown options (filtered by selected Region)
  const asmOptions = useMemo(() => {
    const list = filterMeta?.asms || [];
    const filtered = region
      ? list.filter((a) => (a.region || '').toLowerCase() === region.toLowerCase())
      : list;
    return filtered.map((a) => ({
      value: String(a.id),
      label: a.name + (!region && a.region ? ` (${a.region})` : ''),
    }));
  }, [filterMeta?.asms, region]);

  // 3. Tech dropdown options (filtered by selected ASM, or by selected Region)
  const techOptions = useMemo(() => {
    let list = filterMeta?.techs || [];
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

  // 4. Farmer dropdown options (filtered by selected Tech, or by selected ASM, or by selected Region)
  const farmerOptions = useMemo(() => {
    let list = filterMeta?.farmers || [];
    if (techId) {
      list = list.filter((f) => String(f.assigned_salesperson_id) === String(techId));
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
  }, [filterMeta?.farmers, filterMeta?.techs, techId, asmId, region]);

  // Cascading change handlers
  const handleRegionChange = (newRegion) => {
    setRegion(newRegion);
    setPage(1);

    if (asmId && newRegion) {
      const currentAsm = (filterMeta?.asms || []).find((a) => String(a.id) === String(asmId));
      if (currentAsm && (currentAsm.region || '').toLowerCase() !== newRegion.toLowerCase()) {
        setAsmId('');
        setTechId('');
        setFarmerId('');
        return;
      }
    }
    if (techId && newRegion) {
      const currentTech = (filterMeta?.techs || []).find((t) => String(t.id) === String(techId));
      if (currentTech && (currentTech.region || '').toLowerCase() !== newRegion.toLowerCase()) {
        setTechId('');
        setFarmerId('');
        return;
      }
    }
    if (farmerId && newRegion) {
      const currentFarmer = (filterMeta?.farmers || []).find((f) => String(f.id) === String(farmerId));
      if (currentFarmer && (currentFarmer.region || '').toLowerCase() !== newRegion.toLowerCase()) {
        setFarmerId('');
      }
    }
  };

  const handleAsmChange = (newAsmId) => {
    setAsmId(newAsmId);
    setPage(1);

    if (newAsmId) {
      const chosenAsm = (filterMeta?.asms || []).find((a) => String(a.id) === String(newAsmId));
      if (chosenAsm?.region && !region) {
        setRegion(chosenAsm.region);
      }
    }

    if (techId && newAsmId) {
      const currentTech = (filterMeta?.techs || []).find((t) => String(t.id) === String(techId));
      if (currentTech && String(currentTech.manager_id) !== String(newAsmId)) {
        setTechId('');
        setFarmerId('');
        return;
      }
    }

    if (farmerId && newAsmId) {
      const techIdsUnderAsm = new Set(
        (filterMeta?.techs || [])
          .filter((t) => String(t.manager_id) === String(newAsmId))
          .map((t) => String(t.id))
      );
      const currentFarmer = (filterMeta?.farmers || []).find((f) => String(f.id) === String(farmerId));
      if (
        currentFarmer &&
        String(currentFarmer.assigned_manager_id) !== String(newAsmId) &&
        !techIdsUnderAsm.has(String(currentFarmer.assigned_salesperson_id))
      ) {
        setFarmerId('');
      }
    }
  };

  const handleTechChange = (newTechId) => {
    setTechId(newTechId);
    setPage(1);

    if (newTechId) {
      const chosenTech = (filterMeta?.techs || []).find((t) => String(t.id) === String(newTechId));
      if (chosenTech) {
        if (chosenTech.manager_id && !asmId) {
          setAsmId(String(chosenTech.manager_id));
        }
        if (chosenTech.region && !region) {
          setRegion(chosenTech.region);
        }
      }
    }

    if (farmerId && newTechId) {
      const currentFarmer = (filterMeta?.farmers || []).find((f) => String(f.id) === String(farmerId));
      if (currentFarmer && String(currentFarmer.assigned_salesperson_id) !== String(newTechId)) {
        setFarmerId('');
      }
    }
  };

  const handleFarmerChange = (newFarmerId) => {
    setFarmerId(newFarmerId);
    setPage(1);

    if (newFarmerId) {
      const chosenFarmer = (filterMeta?.farmers || []).find((f) => String(f.id) === String(newFarmerId));
      if (chosenFarmer) {
        if (chosenFarmer.assigned_salesperson_id && !techId) {
          setTechId(String(chosenFarmer.assigned_salesperson_id));
        }
        if (chosenFarmer.assigned_manager_id && !asmId) {
          setAsmId(String(chosenFarmer.assigned_manager_id));
        }
        if (chosenFarmer.region && !region) {
          setRegion(chosenFarmer.region);
        }
      }
    }
  };

  const handleReset = () => {
    setRegion('');
    setAsmId('');
    setTechId('');
    setFarmerId('');
    setMeetingType('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    region || asmId || techId || farmerId || meetingType || fromDate || toDate
  );

  const { data, isLoading } = useQuery({
    queryKey: ['visits', page, region, asmId, techId, farmerId, meetingType, fromDate, toDate],
    queryFn: () =>
      visitApi
        .list({
          page,
          limit: 20,
          region: region || undefined,
          asm_id: asmId || undefined,
          tech_id: techId || undefined,
          client_id: farmerId || undefined,
          meeting_type: meetingType || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        })
        .then((r) => r.data),
  });

  const handleExport = async () => {
    try {
      const res = await visitApi.export({
        region: region || undefined,
        asm_id: asmId || undefined,
        tech_id: techId || undefined,
        client_id: farmerId || undefined,
        meeting_type: meetingType || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      downloadBlob(res.data, 'visits.xlsx');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Visit Logs</h1>
          <p className="text-sm text-gray-500">
            {data?.pagination?.total || 0} visits {hasActiveFilters && '(filtered)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary btn-sm text-red-600 hover:bg-red-50 hover:border-red-200 transition"
              title="Reset all filters"
            >
              <FunnelIcon className="w-4 h-4" /> Reset Filters
            </button>
          )}
          <button onClick={handleExport} className="btn-secondary btn-sm">
            <ArrowDownTrayIcon className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Filter Toolbar: All filters fit in one row, no sliding bar */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-2.5">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 w-full">
          {/* 1. Regions Dropdown */}
          <select
            value={region}
            onChange={(e) => handleRegionChange(e.target.value)}
            className={`h-[38px] px-2.5 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer flex-1 min-w-[115px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              region
                ? 'bg-blue-50/60 text-blue-900 border-blue-300 font-semibold'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            <option value="">All Regions</option>
            {regionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 2. ASM Dropdown */}
          <select
            value={asmId}
            onChange={(e) => handleAsmChange(e.target.value)}
            className={`h-[38px] px-2.5 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer flex-1 min-w-[115px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              asmId
                ? 'bg-blue-50/60 text-blue-900 border-blue-300 font-semibold'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            <option value="">All ASMs</option>
            {asmOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 3. Tech Dropdown */}
          <select
            value={techId}
            onChange={(e) => handleTechChange(e.target.value)}
            className={`h-[38px] px-2.5 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer flex-1 min-w-[115px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              techId
                ? 'bg-blue-50/60 text-blue-900 border-blue-300 font-semibold'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            <option value="">All Techs</option>
            {techOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 4. Farmer Dropdown */}
          <select
            value={farmerId}
            onChange={(e) => handleFarmerChange(e.target.value)}
            className={`h-[38px] px-2.5 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              farmerId
                ? 'bg-blue-50/60 text-blue-900 border-blue-300 font-semibold'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            <option value="">All Farmers</option>
            {farmerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 5. Meeting Type */}
          <select
            value={meetingType}
            onChange={(e) => {
              setMeetingType(e.target.value);
              setPage(1);
            }}
            className={`h-[38px] px-2.5 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              meetingType
                ? 'bg-blue-50/60 text-blue-900 border-blue-300 font-semibold'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            <option value="">Meeting Type</option>
            {MEETING_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 6. Date Range Filter (From - To) */}
          <div
            className={`flex items-center gap-1.5 bg-white border rounded-lg px-2.5 h-[38px] shadow-xs text-xs transition shrink-0 ${
              fromDate || toDate
                ? 'border-blue-300 bg-blue-50/40 ring-1 ring-blue-100'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <CalendarDaysIcon
              className={`w-3.5 h-3.5 shrink-0 ${fromDate || toDate ? 'text-blue-600' : 'text-gray-400'}`}
            />
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-0 text-xs text-gray-800 focus:outline-none focus:ring-0 p-0 cursor-pointer w-[98px]"
                title="From date"
              />
            </div>
            <span className="text-gray-300 font-light select-none">|</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-0 text-xs text-gray-800 focus:outline-none focus:ring-0 p-0 cursor-pointer w-[98px]"
                title="To date"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setPage(1);
                }}
                className="text-gray-400 hover:text-red-500 p-0.5 rounded-full hover:bg-gray-100 transition shrink-0"
                title="Clear date filter"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="card">
          {data?.data?.length === 0 ? (
            <EmptyState
              title="No visits found"
              description={
                hasActiveFilters
                  ? 'Try adjusting or clearing your filters to see more visit logs.'
                  : 'No visits have been logged yet.'
              }
              icon={MapPinIcon}
            />
          ) : (
            <>
              <div className="hidden sm:block table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Farmer</th>
                      <th>Tank</th>
                      <th>Technical Executive</th>
                      <th>Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((v) => (
                      <tr key={v.id}>
                        <td className="text-gray-600 whitespace-nowrap">{v.visit_date}</td>
                        <td>
                          <Link
                            to={`/clients/${v.client_id || ''}`}
                            className="font-medium text-gray-900 hover:text-blue-600"
                          >
                            {v.company_name}
                          </Link>
                          {v.city && <p className="text-xs text-gray-400">{v.city}</p>}
                        </td>
                        <td className="text-gray-600 whitespace-nowrap font-medium text-xs">
                          {v.tank_number ? (
                            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                              {v.tank_number}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="text-gray-600">{v.salesperson_name}</td>
                        <td>
                          <Badge color="blue">
                            {MEETING_TYPES.find((t) => t.value === v.meeting_type)?.label ||
                              v.meeting_type}
                          </Badge>
                        </td>
                        <td>
                          <Link
                            to={`/visits/${v.id}`}
                            className="text-blue-600 text-xs hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden divide-y divide-gray-100">
                {data.data.map((v) => (
                  <div key={v.id} className="px-4 py-4">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {v.company_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {v.visit_date} · {v.salesperson_name}
                        </p>
                      </div>
                      <Link
                        to={`/visits/${v.id}`}
                        className="text-blue-600 text-xs hover:underline shrink-0"
                      >
                        View Details
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color="blue">
                        {MEETING_TYPES.find((t) => t.value === v.meeting_type)?.label ||
                          v.meeting_type}
                      </Badge>
                      {v.tank_number && (
                        <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-medium">
                          {v.tank_number}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Pagination meta={data.pagination} onPageChange={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
