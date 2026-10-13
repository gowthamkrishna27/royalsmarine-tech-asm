import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tankApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import EmptyState from '../../components/common/EmptyState';
import {
  CircleStackIcon, ArrowLeftIcon, CheckCircleIcon,
  ArchiveBoxIcon, ScaleIcon, MapPinIcon,
} from '@heroicons/react/24/outline';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'harvested', label: 'Harvested' },
  { value: 'fallow', label: 'Fallow / Empty' },
  { value: 'nursery', label: 'Nursery' },
  { value: 'inactive', label: 'Inactive' },
];

export default function TanksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';
  const initialView = searchParams.get('view') || '';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [view, setView] = useState(initialView);

  // Sync state if URL query params change
  useEffect(() => {
    setStatus(searchParams.get('status') || '');
    setView(searchParams.get('view') || '');
    setPage(1);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['tanks-list', page, search, status, view],
    queryFn: () => tankApi.list({ page, limit: 20, search, status, view }).then(r => r.data),
  });

  const tanks = data?.data || [];
  const meta = data?.pagination;
  const stats = meta?.stats || {};

  const getPageTitle = () => {
    if (view === 'abw') return 'Average ABW & Tank Metrics';
    if (status === 'active') return 'Active Tanks';
    if (status === 'harvested') return 'Harvested Tanks';
    return 'Total Tanks Overview';
  };

  const setTab = (newStatus, newView = '') => {
    setStatus(newStatus);
    setView(newView);
    setPage(1);
    const params = {};
    if (newStatus) params.status = newStatus;
    if (newView) params.view = newView;
    setSearchParams(params);
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-2.5 py-1 rounded-md"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" /> Back
            </Link>
          </div>
          <h1 className="page-title">{getPageTitle()}</h1>
          <p className="text-sm text-gray-500">
          </p>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setTab('', '')}
          className={`card p-4 text-left transition-all ${status === '' && view === '' ? 'ring-2 ring-blue-500 bg-blue-50/30' : 'hover:bg-gray-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <CircleStackIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Tanks</p>
              <p className="text-xl font-bold text-gray-900">{stats.total_tanks ?? 0}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setTab('active', '')}
          className={`card p-4 text-left transition-all ${status === 'active' && view === '' ? 'ring-2 ring-green-500 bg-green-50/30' : 'hover:bg-gray-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <CheckCircleIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Active Tanks</p>
              <p className="text-xl font-bold text-gray-900">{stats.active_tanks ?? 0}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setTab('harvested', '')}
          className={`card p-4 text-left transition-all ${status === 'harvested' && view === '' ? 'ring-2 ring-yellow-500 bg-yellow-50/30' : 'hover:bg-gray-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600">
              <ArchiveBoxIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Harvested Tanks</p>
              <p className="text-xl font-bold text-gray-900">{stats.harvested_tanks ?? 0}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setTab('', 'abw')}
          className={`card p-4 text-left transition-all ${view === 'abw' ? 'ring-2 ring-indigo-500 bg-indigo-50/30' : 'hover:bg-gray-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <ScaleIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Average ABW</p>
              <p className="text-xl font-bold text-gray-900">{stats.avg_abw ? `${stats.avg_abw} g` : '0 g'}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        onSearch={setSearch}
        searchValue={search}
        onReset={() => {
          setSearch('');
          setStatus('');
          setView('');
          setSearchParams({});
        }}
      >
        <SelectFilter
          label="All Statuses"
          value={status}
          onChange={(val) => {
            setStatus(val);
            setPage(1);
            const params = {};
            if (val) params.status = val;
            if (view) params.view = view;
            setSearchParams(params);
          }}
          options={STATUS_OPTIONS}
          className="sm:w-48"
        />
        {view === 'abw' && (
          <span className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200/70 flex-shrink-0 whitespace-nowrap">
            <ScaleIcon className="w-4 h-4 text-indigo-600" /></span>
        )}
      </FilterBar>

      {/* Table Content */}
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="card">
          {tanks.length === 0 ? (
            <EmptyState
              title="No tanks found"
              message={
                search || status || view
                  ? 'No tanks match the selected filters.'
                  : 'No farmer tanks have been registered yet. Add tanks through the Farmer master.'
              }
              icon={CircleStackIcon}
            />
          ) : (
            <>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tank Number / Name</th>
                      <th>Farmer</th>
                      <th>Location</th>
                      <th>Size (Acres)</th>
                      <th>ABW</th>
                      <th>Salinity</th>
                      <th>Seed Date</th>
                      <th>Stocking (Lakhs)</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tanks.map((t) => (
                      <tr key={t.id || t.uuid}>
                        <td>
                          <div className="font-semibold text-gray-900 flex items-center gap-2">
                            <span>{t.tank_number || t.tank_name}</span>
                            {t.latitude && t.longitude && (
                              <a
                                href={`https://www.google.com/maps?q=${t.latitude},${t.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                title="View on map"
                                className="text-blue-500 hover:text-blue-700"
                              >
                                <MapPinIcon className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          {t.culture_type && (
                            <span className="text-xs text-gray-400 capitalize">{t.culture_type}</span>
                          )}
                        </td>
                        <td>
                          {t.farmer_id ? (
                            <Link
                              to={`/clients/${t.farmer_id}`}
                              className="text-blue-600 font-medium hover:underline block"
                            >
                              {t.farmer_name}
                            </Link>
                          ) : (
                            <span className="text-gray-900">{t.farmer_name || '—'}</span>
                          )}
                          <span className="text-xs text-gray-400">{t.farmer_mobile || ''}</span>
                        </td>
                        <td className="text-gray-600 text-xs">
                          {[t.village, t.area, t.city].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="text-gray-700 font-medium">
                          {t.size_acres ? `${t.size_acres} Ac` : '—'}
                        </td>
                        <td>
                          {t.abw && Number(t.abw) > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">
                              {Number(t.abw).toFixed(1)} g
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="text-gray-600 text-xs">
                          {t.salinity ? `${t.salinity} ppt` : '—'}
                        </td>
                        <td className="text-gray-600 text-xs">
                          {t.seed_date ? t.seed_date.substring(0, 10) : '—'}
                        </td>
                        <td className="text-gray-600 text-xs">
                          {t.stocking_quantity_lakhs ? `${t.stocking_quantity_lakhs} L` : '—'}
                        </td>
                        <td>
                          <Badge
                            color={
                              t.status === 'active'
                                ? 'green'
                                : t.status === 'harvested'
                                  ? 'yellow'
                                  : t.status === 'nursery'
                                    ? 'blue'
                                    : 'gray'
                            }
                          >
                            {t.status || 'Active'}
                          </Badge>
                        </td>
                        <td>
                          {t.farmer_id && (
                            <Link
                              to={`/clients/${t.farmer_id}`}
                              className="text-blue-600 text-xs font-semibold hover:underline"
                            >
                              View Farmer →
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {meta && <Pagination meta={meta} onPageChange={setPage} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
