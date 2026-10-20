import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { clientApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import { BuildingOfficeIcon, PlusIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { CLIENT_TYPES } from '../../constants';
import { downloadBlob } from '../../hooks/useApi';
import toast from 'react-hot-toast';

const CLIENT_TYPE_COLOR = { existing_client: 'green', new_prospect: 'blue', retailer: 'orange', corporate: 'purple', distributor: 'indigo', government: 'yellow', other: 'gray' };

export default function Clients() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [clientType, setClientType] = useState('');
  const [status, setStatus] = useState('');
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search, clientType, status],
    queryFn: () => clientApi.list({ page, limit: 20, search, client_type: clientType, status }).then(r => r.data),
  });

  const handleExport = async () => {
    try {
      const res = await clientApi.export({ search, client_type: clientType, status });
      downloadBlob(res.data, 'clients.xlsx');
    } catch { toast.error('Export failed'); }
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
          <p className="text-sm text-gray-500">{data?.pagination?.total || 0} total farmers</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExport} className="btn-secondary btn-sm">
            <ArrowDownTrayIcon className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setImportModal(true)} className="btn-secondary btn-sm">
            <ArrowUpTrayIcon className="w-4 h-4" /> Import Excel
          </button>
          <Link to="/clients/new" className="btn-primary btn-sm">
            <PlusIcon className="w-4 h-4" /> Add Farmer
          </Link>
        </div>
      </div>

      <FilterBar onSearch={setSearch} searchValue={search} onReset={() => { setSearch(''); setClientType(''); setStatus(''); }}>
        <SelectFilter label="All Types" value={clientType} onChange={setClientType} options={CLIENT_TYPES} />
        <SelectFilter label="All Status" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
      </FilterBar>

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
                        <td><Badge color={c.status === 'active' ? 'green' : 'red'}>{c.status}</Badge></td>
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
                        <Badge color={c.status === 'active' ? 'green' : 'red'}>{c.status}</Badge>
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
