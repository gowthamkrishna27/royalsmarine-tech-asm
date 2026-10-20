import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { visitApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import EmptyState from '../../components/common/EmptyState';
import { MapPinIcon, PlusIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { MEETING_TYPES } from '../../constants';
import { downloadBlob } from '../../hooks/useApi';
import toast from 'react-hot-toast';

export default function Visits() {
  const [page, setPage] = useState(1);
  const [meetingType, setMeetingType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['visits', page, meetingType, fromDate, toDate],
    queryFn: () => visitApi.list({ page, limit: 20, meeting_type: meetingType, from_date: fromDate, to_date: toDate }).then(r => r.data),
  });

  const handleExport = async () => {
    try {
      const res = await visitApi.export({ meeting_type: meetingType, from_date: fromDate, to_date: toDate });
      downloadBlob(res.data, 'visits.xlsx');
    } catch { toast.error('Export failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Visit Reports</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total || 0} visits</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary btn-sm"><ArrowDownTrayIcon className="w-4 h-4" /> Export</button>
          <Link to="/visits/new" className="btn-primary btn-sm"><PlusIcon className="w-4 h-4" /> Add Visit</Link>
        </div>
      </div>

      <FilterBar onReset={() => { setMeetingType(''); setFromDate(''); setToDate(''); }}>
        <SelectFilter label="Meeting Type" value={meetingType} onChange={setMeetingType} options={MEETING_TYPES} />
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input flex-shrink-0" placeholder="From" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input flex-shrink-0" placeholder="To" />
      </FilterBar>

      {isLoading ? <PageSpinner /> : (
        <div className="card">
          {data?.data?.length === 0 ? (
            <EmptyState title="No visits found" icon={MapPinIcon}
              action={<Link to="/visits/new" className="btn-primary btn-sm">Add Visit</Link>} />
          ) : (
            <>
              <div className="hidden sm:block table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Farmer</th>
                      <th>Tank</th>
                      <th>Salesperson</th>
                      <th>Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map(v => (
                      <tr key={v.id}>
                        <td className="text-gray-600 whitespace-nowrap">{v.visit_date}</td>
                        <td>
                          <Link to={`/clients/${v.client_id || ''}`} className="font-medium text-gray-900 hover:text-blue-600">
                            {v.company_name}
                          </Link>
                          {v.city && <p className="text-xs text-gray-400">{v.city}</p>}
                        </td>
                        <td className="text-gray-600 whitespace-nowrap font-medium text-xs">
                          {v.tank_number ? (
                            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                              {v.tank_number}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="text-gray-600">{v.salesperson_name}</td>
                        <td><Badge color="blue">{MEETING_TYPES.find(t => t.value === v.meeting_type)?.label || v.meeting_type}</Badge></td>
                        <td>
                          <Link to={`/visits/${v.id}`} className="text-blue-600 text-xs hover:underline">View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile Cards */}
              <div className="sm:hidden divide-y divide-gray-100">
                {data.data.map(v => (
                  <div key={v.id} className="px-4 py-4">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{v.company_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{v.visit_date} · {v.salesperson_name}</p>
                      </div>
                      <Link to={`/visits/${v.id}`} className="text-blue-600 text-xs hover:underline shrink-0">View Details</Link>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color="blue">{MEETING_TYPES.find(t => t.value === v.meeting_type)?.label || v.meeting_type}</Badge>
                      {v.tank_number && <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-medium">{v.tank_number}</span>}
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
