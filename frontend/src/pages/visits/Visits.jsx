import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { visitApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter, DateFilter } from '../../components/common/FilterBar';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import { MapPinIcon, PlusIcon, ArrowDownTrayIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { MEETING_TYPES, VISIT_APPROVAL } from '../../constants';
import { downloadBlob } from '../../hooks/useApi';
import toast from 'react-hot-toast';

export default function Visits() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [approvalStatus, setApprovalStatus] = useState('');
  const [meetingType, setMeetingType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['visits', page, approvalStatus, meetingType, fromDate, toDate],
    queryFn: () => visitApi.list({ page, limit: 20, approval_status: approvalStatus, meeting_type: meetingType, from_date: fromDate, to_date: toDate }).then(r => r.data),
  });

  const handleApprove = async (id) => {
    try {
      await visitApi.approve(id, { status: 'approved' });
      toast.success('Visit approved');
      qc.invalidateQueries(['visits']);
    } catch { toast.error('Failed to approve'); }
  };

  const handleReject = async () => {
    try {
      await visitApi.approve(rejectModal, { status: 'rejected', rejection_reason: rejectionReason });
      toast.success('Visit rejected');
      setRejectModal(null);
      setRejectionReason('');
      qc.invalidateQueries(['visits']);
    } catch { toast.error('Failed to reject'); }
  };

  const handleExport = async () => {
    try {
      const res = await visitApi.export({ approval_status: approvalStatus, meeting_type: meetingType, from_date: fromDate, to_date: toDate });
      downloadBlob(res.data, 'visits.xlsx');
    } catch { toast.error('Export failed'); }
  };

  const isManager = hasRole('super_admin', 'admin', 'sales_manager');

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

      <FilterBar onReset={() => { setApprovalStatus(''); setMeetingType(''); setFromDate(''); setToDate(''); }}>
        <SelectFilter label="All Status" value={approvalStatus} onChange={setApprovalStatus} options={[
          { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }
        ]} />
        <SelectFilter label="Meeting Type" value={meetingType} onChange={setMeetingType} options={MEETING_TYPES} />
        <DateFilter label="From:" value={fromDate} onChange={setFromDate} max={toDate || undefined} />
        <DateFilter label="To:" value={toDate} onChange={setToDate} min={fromDate || undefined} />
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
                      <th>Salesperson</th>
                      <th>Type</th>
                      <th>Person Met</th>
                      <th>Status</th>
                      {isManager && <th>Actions</th>}
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
                        <td className="text-gray-600">{v.salesperson_name}</td>
                        <td><Badge color="blue">{MEETING_TYPES.find(t => t.value === v.meeting_type)?.label || v.meeting_type}</Badge></td>
                        <td className="text-gray-600">{v.person_met || '—'}</td>
                        <td>
                          <Badge color={v.approval_status === 'approved' ? 'green' : v.approval_status === 'rejected' ? 'red' : 'yellow'}>
                            {v.approval_status}
                          </Badge>
                        </td>
                        {isManager && (
                          <td>
                            <div className="flex items-center gap-1">
                              <Link to={`/visits/${v.id}`} className="text-blue-600 text-xs hover:underline">View</Link>
                              {v.approval_status === 'pending' && (
                                <>
                                  <button onClick={() => handleApprove(v.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approve">
                                    <CheckIcon className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setRejectModal(v.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Reject">
                                    <XMarkIcon className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
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
                      <Badge color={v.approval_status === 'approved' ? 'green' : v.approval_status === 'rejected' ? 'red' : 'yellow'}>{v.approval_status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color="blue">{MEETING_TYPES.find(t => t.value === v.meeting_type)?.label || v.meeting_type}</Badge>
                      {v.person_met && <span className="text-xs text-gray-500">Met: {v.person_met}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Link to={`/visits/${v.id}`} className="text-blue-600 text-xs hover:underline">View Details</Link>
                      {isManager && v.approval_status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(v.id)} className="text-green-600 text-xs font-medium hover:underline">✓ Approve</button>
                          <button onClick={() => setRejectModal(v.id)} className="text-red-500 text-xs font-medium hover:underline">✗ Reject</button>
                        </>
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

      <Modal open={Boolean(rejectModal)} onClose={() => setRejectModal(null)} title="Reject Visit">
        <div className="space-y-4">
          <div>
            <label className="label">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} className="input" rows={3} placeholder="Explain why the visit is being rejected..." />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setRejectModal(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleReject} disabled={!rejectionReason} className="btn-danger">Reject Visit</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
