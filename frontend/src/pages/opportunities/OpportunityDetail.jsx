import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { opportunityApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { OPPORTUNITY_STAGES } from '../../constants';
import toast from 'react-hot-toast';
import { PencilIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

export default function OpportunityDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [stageModal, setStageModal] = useState(false);
  const [newStage, setNewStage] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [comment, setComment] = useState('');
  const [stageRemarks, setStageRemarks] = useState('');

  const { data: opp, isLoading } = useQuery({
    queryKey: ['opportunity', id],
    queryFn: () => opportunityApi.get(id).then(r => r.data.data),
  });

  const handleStageChange = async () => {
    try {
      await opportunityApi.changeStage(id, { stage: newStage, remarks: stageRemarks, lost_reason: lostReason });
      toast.success(`Stage changed to ${newStage}`);
      qc.invalidateQueries(['opportunity', id]);
      setStageModal(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    try {
      await opportunityApi.addComment(id, comment);
      toast.success('Comment added');
      setComment('');
      qc.invalidateQueries(['opportunity', id]);
    } catch { toast.error('Failed'); }
  };

  if (isLoading) return <PageSpinner />;
  if (!opp) return <div className="text-center py-16 text-gray-500">Opportunity not found</div>;

  const stage = OPPORTUNITY_STAGES.find(s => s.value === opp.current_stage);

  return (
    <div className="space-y-6 fade-in">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">{opp.title}</h1>
            {stage && <Badge color={stage.color}>{stage.label}</Badge>}
          </div>
          <p className="text-sm text-gray-500 mt-1">{opp.company_name} · {opp.salesperson_name}</p>
        </div>
        <button onClick={() => { setNewStage(opp.current_stage); setStageModal(true); }} className="btn-primary btn-sm">
          Change Stage
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details */}
        <div className="card lg:col-span-1">
          <div className="card-header"><h3 className="font-semibold text-gray-900">Details</h3></div>
          <div className="card-body space-y-3 text-sm">
            {[
              ['Farmer', opp.company_name],
              ['Brand', opp.brand_name],
              ['Category', opp.category_name],
              ['Estimated Value', opp.estimated_value ? `₹${Number(opp.estimated_value).toLocaleString('en-IN')}` : '—'],
              ['Probability', `${opp.probability}%`],
              ['Expected Close', opp.expected_closing_date || '—'],
              ['Manager', opp.manager_name || '—'],
              ['Salesperson', opp.salesperson_name],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">{k}</span>
                <span className="font-medium text-gray-900">{v || '—'}</span>
              </div>
            ))}
            {opp.requirement_details && (
              <div className="pt-2">
                <p className="text-xs font-medium text-gray-500 mb-1">Requirements</p>
                <p className="text-gray-800">{opp.requirement_details}</p>
              </div>
            )}
            {opp.competitor_info && (
              <div className="pt-2">
                <p className="text-xs font-medium text-gray-500 mb-1">Competitor Info</p>
                <p className="text-gray-800">{opp.competitor_info}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stage history + Comments */}
        <div className="card lg:col-span-2 space-y-0">
          <div className="card-header"><h3 className="font-semibold text-gray-900">Stage History</h3></div>
          <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
            {opp.stageHistory?.map(h => (
              <div key={h.id} className="px-6 py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-gray-700">
                    {h.from_stage ? <><span className="text-gray-400">{h.from_stage}</span> → </> : ''}
                    <span className="font-medium">{h.to_stage}</span>
                  </p>
                  {h.remarks && <p className="text-xs text-gray-400">{h.remarks}</p>}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{h.changed_by_name} · {new Date(h.changed_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>

          <div className="card-header border-t border-gray-100"><h3 className="font-semibold text-gray-900">Comments</h3></div>
          <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
            {opp.comments?.length === 0 && <p className="px-6 py-4 text-sm text-gray-400">No comments yet</p>}
            {opp.comments?.map(c => (
              <div key={c.id} className="px-6 py-3">
                <p className="text-xs font-medium text-gray-500">{c.author} · {new Date(c.created_at).toLocaleDateString()}</p>
                <p className="text-sm text-gray-800 mt-0.5">{c.comment}</p>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
            <input value={comment} onChange={e => setComment(e.target.value)} className="input flex-1" placeholder="Add a comment..." onKeyDown={e => e.key === 'Enter' && handleComment()} />
            <button onClick={handleComment} className="btn-primary btn-sm">
              <ChatBubbleLeftIcon className="w-4 h-4" /> Post
            </button>
          </div>
        </div>
      </div>

      <Modal open={stageModal} onClose={() => setStageModal(false)} title="Change Opportunity Stage">
        <div className="space-y-4">
          <div>
            <label className="label">New Stage</label>
            <div className="grid grid-cols-2 gap-2">
              {OPPORTUNITY_STAGES.map(s => (
                <button key={s.value} type="button" onClick={() => setNewStage(s.value)}
                  className={`p-3 rounded-lg border text-sm font-medium text-left transition ${newStage === s.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                  <Badge color={s.color}>{s.label}</Badge>
                </button>
              ))}
            </div>
          </div>
          {newStage === 'lost' && (
            <div>
              <label className="label">Lost Reason <span className="text-red-500">*</span></label>
              <textarea value={lostReason} onChange={e => setLostReason(e.target.value)} className="input" rows={2} placeholder="Why was this opportunity lost?" />
            </div>
          )}
          <div>
            <label className="label">Remarks (optional)</label>
            <textarea value={stageRemarks} onChange={e => setStageRemarks(e.target.value)} className="input" rows={2} />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setStageModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleStageChange} disabled={!newStage || (newStage === 'lost' && !lostReason)} className="btn-primary">
              Change Stage
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
