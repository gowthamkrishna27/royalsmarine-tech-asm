import { useState, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { clientApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar from '../../components/common/FilterBar';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import { BuildingOfficeIcon, PlusIcon, ArrowDownTrayIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { downloadBlob } from '../../hooks/useApi';
import toast from 'react-hot-toast';

const CLIENT_TYPE_COLOR = { existing_client: 'green', new_prospect: 'blue', retailer: 'orange', corporate: 'purple', distributor: 'indigo', government: 'yellow', other: 'gray' };

export default function Clients() {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [asmId, setAsmId] = useState('');
  const [techId, setTechId] = useState('');
    const [status, setStatus] = useState(searchParams.get('status') || '');

  // Fetch filter metadata (regions, ASMs, techs)
  const { data: filterMeta } = useQuery({
    queryKey: ['visit-filters'],
    queryFn: () => clientApi.getFilters().then((r) => r.data.data),
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

  // Cascading change handlers
  const handleRegionChange = (newRegion) => {
    setRegion(newRegion);
    setPage(1);

    if (asmId && newRegion) {
      const currentAsm = (filterMeta?.asms || []).find((a) => String(a.id) === String(asmId));
      if (currentAsm && (currentAsm.region || '').toLowerCase() !== newRegion.toLowerCase()) {
        setAsmId('');
        setTechId('');
        return;
      }
    }
    if (techId && newRegion) {
      const currentTech = (filterMeta?.techs || []).find((t) => String(t.id) === String(techId));
      if (currentTech && (currentTech.region || '').toLowerCase() !== newRegion.toLowerCase()) {
        setTechId('');
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
  };

  const handleReset = () => {
    setSearch('');
    setRegion('');
    setAsmId('');
    setTechId('');
    setStatus('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || region || asmId || techId || status);
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search, status, region, asmId, techId],
    queryFn: () =>
      clientApi
        .list({
          page,
          limit: 20,
          search: search || undefined,
          status: status || undefined,
          region: region || undefined,
          asm_id: asmId || undefined,
          tech_id: techId || undefined,
        })
        .then((r) => r.data),
  });

  const handleExport = async () => {
    try {
      const res = await clientApi.export({
        search: search || undefined,
        status: status || undefined,
        region: region || undefined,
        asm_id: asmId || undefined,
        tech_id: techId || undefined,
      });
      downloadBlob(res.data, 'clients.xlsx');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleImport = async () => {
    if (!importFile) return toast.error('Please select a file');
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await clientApi.import(fd);
      setImportResult(res.data.data);
      toast.success(`Imported ${res.data.data.imported} farmers`);
      qc.invalidateQueries(['clients']);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally { setImporting(false); }
  };

  const closeImportModal = () => { setImportModal(false); setImportFile(null); setImportResult(null); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Farmers</h1>
          <p className="text-sm text-gray-500">
            {data?.pagination?.total || 0} total farmers {hasActiveFilters && '(filtered)'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <Link to="/clients/new" className="btn-primary btn-sm">
            <PlusIcon className="w-4 h-4" /> Add Farmer
          </Link>
        </div>
      </div>

      {/* Filter Toolbar: All filters aligned in a single row */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-2.5 mb-4">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 w-full">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[170px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search farmers..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input pl-9 h-[38px] text-xs font-medium w-full"
            />
          </div>

          {/* 1. Regions */}
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

          {/* 2. ASM */}
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

          {/* 3. Tech */}
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

          {/* 5. Status */}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={`h-[38px] px-2.5 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer flex-1 min-w-[110px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              status
                ? 'bg-blue-50/60 text-blue-900 border-blue-300 font-semibold'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="forcely_closed">Forcely Closed</option>
          </select>
        </div>
      </div>

      {isLoading ? <PageSpinner /> : (
        <div className="card">
          {data?.data?.length === 0 ? (
            <EmptyState title="No farmers found" description="Add your first farmer to get started" icon={BuildingOfficeIcon}
              action={<Link to="/clients/new" className="btn-primary btn-sm">Add Farmer</Link>} />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Farmer Name</th>
                      <th>Phone</th>
                      <th>Area / Village</th>
                      <th>Extent</th>
                      <th>Tanks</th>
                      <th>Technical Executive</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map(c => (
                      <tr key={c.id}>
                        <td className="font-medium text-gray-900">{c.company_name}</td>
                        <td className="text-gray-600">{c.mobile || '—'}</td>
                        <td className="text-gray-600">{[c.village, c.area].filter(Boolean).join(', ') || c.city || '—'}</td>
                        <td className="text-gray-600">{c.farm_extent_acres ? `${c.farm_extent_acres} Ac` : '—'}</td>
                        <td className="text-gray-600">{c.number_of_tanks ? `${c.number_of_tanks}` : '—'}</td>
                        <td className="text-gray-600">{c.salesperson_name || '—'}</td>
                        <td><Badge color={c.status === 'active' ? 'green' : c.status === 'forcely_closed' ? 'amber' : 'red'}>{c.status === 'forcely_closed' ? 'Forcely Closed' : c.status}</Badge></td>
                        <td><Link to={`/clients/${c.id}`} className="text-blue-600 text-sm hover:underline">View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden divide-y divide-gray-100">
                {data.data.map(c => (
                  <Link to={`/clients/${c.id}`} key={c.id} className="block px-4 py-4 hover:bg-gray-50 active:bg-gray-100">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{c.company_name}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{c.mobile || ''}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {[c.village, c.area, c.city].filter(Boolean).join(', ')}
                          {c.farm_extent_acres ? ` · ${c.farm_extent_acres} Acres` : ''}
                          {c.number_of_tanks ? ` · ${c.number_of_tanks} Tanks` : ''}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge color={c.status === 'active' ? 'green' : c.status === 'forcely_closed' ? 'amber' : 'red'}>{c.status === 'forcely_closed' ? 'Forcely Closed' : c.status}</Badge>
                      </div>
                    </div>
                    {c.salesperson_name && <p className="text-xs text-blue-600 mt-2">👤 {c.salesperson_name}</p>}
                  </Link>
                ))}
              </div>

              <Pagination meta={data.pagination} onPageChange={setPage} />
            </>
          )}
        </div>
      )}

      {/* Import Modal */}
      <Modal open={importModal} onClose={closeImportModal} title="Import Farmers from Excel">
        {importResult ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-700">{importResult.total}</p>
                <p className="text-xs text-blue-600">Total Rows</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-700">{importResult.imported}</p>
                <p className="text-xs text-green-600">Imported</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-yellow-700">{importResult.skipped}</p>
                <p className="text-xs text-yellow-600">Skipped</p>
              </div>
            </div>
            {importResult.errors?.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-sm font-medium text-red-700 mb-1">Errors ({importResult.errors.length})</p>
                {importResult.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-red-600">Row {e.row}: {e.error}</p>
                ))}
              </div>
            )}
            <button onClick={closeImportModal} className="btn-primary w-full">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
              <p className="font-semibold mb-1">Excel Column Format (Row 1 = Header)</p>
              <p className="text-xs text-blue-600">Farmer / Farm Name | Contact Person | Mobile | Email | City | State | Pincode | Farmer Type | Industry Type | Technical Executive Email</p>
              <p className="text-xs text-blue-500 mt-1">Farmer Type values: existing_client, new_prospect, retailer, corporate, distributor, government, other</p>
            </div>
            <div>
              <label className="label">Select Excel File (.xlsx)</label>
              <input ref={fileRef} type="file" accept=".xlsx,.xls"
                onChange={e => setImportFile(e.target.files[0])}
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
              {importFile && <p className="text-xs text-gray-500 mt-1">Selected: {importFile.name}</p>}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={closeImportModal} className="btn-secondary">Cancel</button>
              <button onClick={handleImport} disabled={importing || !importFile} className="btn-primary">
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
