import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { followupApi, clientApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Modal from '../../components/common/Modal';
import {
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

/* ------------------------------------------------------------------ */
/* Modal: Test Details View                                           */
/* ------------------------------------------------------------------ */
function TestDetailsModal({ test, onClose, onCompleteClick }) {
  if (!test) return null;

  const isAsm = test.submitter_type === 'asm';
  const isCompleted = test.followup_status === 'completed';
  const isOverdue = test.followup_status === 'overdue';

  let parsedParams = test.parameters;
  if (typeof parsedParams === 'string') {
    try {
      parsedParams = JSON.parse(parsedParams);
    } catch {
      parsedParams = null;
    }
  }

  return (
    <Modal open={Boolean(test)} onClose={onClose} title="Test Details" size="lg">
      <div className="space-y-4 text-xs">
        {/* Header Summary */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-gray-900">{test.test_type}</h3>
              {isCompleted ? (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Completed
                </span>
              ) : isOverdue ? (
                <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                  {test.days_overdue}d Overdue
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Due Today
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 font-mono">ID: {test.id}</p>
          </div>

          <div className="text-right flex-shrink-0">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Test Date</span>
            <span className="font-semibold text-gray-800">{test.test_date}</span>
            {test.submission_time && (
              <span className="text-[11px] text-gray-400 block">{test.submission_time}</span>
            )}
          </div>
        </div>

        {/* 2-Column Info: Farmer & Submitter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Client & Pond Info */}
          <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-3 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
              Farmer / Client
            </span>
            <div className="font-semibold text-gray-900 text-sm">{test.farmer_name}</div>
            <div className="text-gray-600 flex items-center gap-1.5">
              <span>Tank / Pond:</span>
              <strong className="text-gray-800">{test.tank_name}</strong>
            </div>
            {test.locality && (
              <div className="text-gray-500">
                <span>Location: </span>
                <span className="text-gray-700">{test.locality}</span>
              </div>
            )}
            {test.farmer_mobile && test.farmer_mobile !== '—' && (
              <div className="text-gray-500">
                <span>Mobile: </span>
                <a href={`tel:${test.farmer_mobile}`} className="text-blue-600 hover:underline">
                  {test.farmer_mobile}
                </a>
              </div>
            )}
          </div>

          {/* Submitter & Admin Follow-up Info */}
          <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-3 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
              Submitted By
            </span>
            <div className="font-semibold text-gray-900 text-sm">
              {test.submitter_name}{' '}
              <span className="text-xs font-normal text-gray-500">
                ({isAsm ? 'Area Sales Manager' : 'Technical Executive / Agent'})
              </span>
            </div>
            {test.due_date && (
              <div className="text-gray-500">
                <span>Due Date: </span>
                <span className="text-gray-700 font-medium">{test.due_date}</span>
              </div>
            )}

            {isCompleted ? (
              <div className="pt-2 border-t border-gray-200/60 mt-2 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">
                  Followed Up By Admin
                </span>
                <div className="font-semibold text-emerald-900">
                  {test.followed_up_by_name}
                </div>
                {test.followed_up_at && (
                  <div className="text-[11px] text-gray-400">
                    {new Date(test.followed_up_at).toLocaleString()}
                  </div>
                )}
                {test.admin_completion_notes && (
                  <div className="text-[11px] text-gray-600 italic bg-white p-2 rounded border border-gray-100">
                    "{test.admin_completion_notes}"
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-2 border-t border-gray-200/60 mt-2">
                <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5" />
                  <span>Pending follow-up review</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Test Parameters */}
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-2">
            Submitted Test Parameters
          </span>
          {parsedParams && typeof parsedParams === 'object' && Object.keys(parsedParams).length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(parsedParams).map(([key, val]) => {
                if (val === null || val === undefined || val === '') return null;
                const formattedKey = key
                  .replace(/_/g, ' ')
                  .replace(/ppm|ppt|pct|c|grams/gi, '')
                  .trim();
                return (
                  <div
                    key={key}
                    className="bg-white border border-gray-200 rounded-lg p-2.5 flex flex-col justify-between"
                  >
                    <span className="text-[11px] text-gray-500 capitalize">{formattedKey}</span>
                    <span className="text-sm font-bold text-gray-900 mt-1">{String(val)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 text-center bg-gray-50 rounded-lg text-gray-400 text-xs">
              No specific parameters recorded for this test.
            </div>
          )}
        </div>

        {/* Observations / Notes if available */}
        {test.notes && (
          <div className="bg-amber-50/50 border border-amber-200/70 rounded-lg p-3">
            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block mb-1">
              Field Observations & Notes
            </span>
            <p className="text-gray-700 text-xs whitespace-pre-wrap">{test.notes}</p>
          </div>
        )}

        {/* GPS location if available */}
        {test.latitude && test.longitude && (
          <div className="flex items-center justify-between text-[11px] text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
            <span>GPS: {test.latitude}, {test.longitude} (±{test.accuracy || '4'}m)</span>
            <a
              href={`https://www.google.com/maps?q=${test.latitude},${test.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              View on Map →
            </a>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            Close
          </button>
          {!isCompleted && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onCompleteClick(test);
              }}
              className="btn-primary btn-sm flex items-center gap-1"
            >
              <CheckIcon className="w-3.5 h-3.5" />
              <span>Complete Follow-up</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Modal: Add General Follow-up                                       */
/* ------------------------------------------------------------------ */
function CreateFollowupModal({ open, onClose, clients, onCreate }) {
  const { register, handleSubmit, reset } = useForm();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await followupApi.create(data);
      toast.success('Created');
      reset();
      onCreate();
      onClose();
    } catch {
      toast.error('Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Follow-up">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
        <div>
          <label className="label">Title</label>
          <input {...register('title', { required: true })} className="input text-xs" />
        </div>
        <div>
          <label className="label">Farmer</label>
          <select {...register('client_id', { required: true })} className="input text-xs">
            <option value="">Select...</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Date</label>
            <input type="date" {...register('followup_date', { required: true })} className="input text-xs" />
          </div>
          <div>
            <label className="label">Priority</label>
            <select {...register('priority')} className="input text-xs">
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Remarks</label>
          <textarea {...register('remarks')} className="input text-xs" rows={2} />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary btn-sm">
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Modal: Complete Test Follow-up                                     */
/* ------------------------------------------------------------------ */
function CompleteTestModal({ test, onClose, onComplete }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('Parameters reviewed. Follow-up completed.');
  const [loading, setLoading] = useState(false);

  if (!test) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await followupApi.completeTest(test.id, notes);
      toast.success('Completed');
      onComplete();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={Boolean(test)} onClose={onClose} title="Complete Test">
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div className="bg-gray-50 border border-gray-200 rounded p-2.5 space-y-1">
          <div className="font-semibold text-gray-900">{test.test_type}</div>
          <div className="text-gray-600">{test.farmer_name} · {test.tank_name}</div>
          <div className="text-gray-400 text-[11px] pt-1 border-t border-gray-200">
            Recipient: <strong className="text-gray-700">{test.submitter_name}</strong> · Admin: <strong className="text-gray-700">{user?.full_name || 'Admin'}</strong>
          </div>
        </div>

        <div>
          <label className="label">Notes / Message</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            required
            className="input text-xs"
            placeholder="Notes..."
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm" disabled={loading}>
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary btn-sm flex items-center gap-1">
            <CheckIcon className="w-3.5 h-3.5" />
            <span>{loading ? 'Saving...' : 'Complete'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Main Followups Page                                                */
/* ------------------------------------------------------------------ */
export default function Followups() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'tests';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [testStatus, setTestStatus] = useState(searchParams.get('status') || '');
  const [testSubmitterType, setTestSubmitterType] = useState('');
  const [testSearch, setTestSearch] = useState('');
  const [completingTest, setCompletingTest] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [animatingCard, setAnimatingCard] = useState(null);

  const handleCardClick = (key, action) => {
    setAnimatingCard(key);
    setTimeout(() => setAnimatingCard(null), 450);
    action();
  };

  const [generalPage, setGeneralPage] = useState(1);
  const [generalStatus, setGeneralStatus] = useState('');
  const [generalAddModal, setGeneralAddModal] = useState(false);
  const [generalCompleteModal, setGeneralCompleteModal] = useState(null);
  const [generalCompleteNotes, setGeneralCompleteNotes] = useState('');

  // 1. Tests
  const { data: testFollowupsData, isLoading: isTestsLoading } = useQuery({
    queryKey: ['followup-tests', testStatus, testSubmitterType, testSearch],
    queryFn: () =>
      followupApi.listTests({
        status: testStatus || undefined,
        submitter_type: testSubmitterType || undefined,
        search: testSearch || undefined,
      }).then((r) => r.data.data),
    refetchInterval: 20000,
  });

  // 2. General
  const { data: generalData, isLoading: isGeneralLoading } = useQuery({
    queryKey: ['followups', generalPage, generalStatus],
    queryFn: () =>
      followupApi.list({ page: generalPage, limit: 20, status: generalStatus }).then((r) => r.data),
    enabled: activeTab === 'general',
  });
  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientApi.list({ limit: 200 }).then((r) => r.data.data),
  });

  const tests = testFollowupsData?.tests || [];
  const stats = testFollowupsData?.stats || {
    total: 0,
    due_count: 0,
    overdue_count: 0,
    completed_count: 0,
    agent_count: 0,
    asm_count: 0,
  };

  const handleGeneralComplete = async () => {
    try {
      await followupApi.complete(generalCompleteModal, generalCompleteNotes);
      toast.success('Completed');
      setGeneralCompleteModal(null);
      setGeneralCompleteNotes('');
      qc.invalidateQueries(['followups']);
    } catch {
      toast.error('Failed');
    }
  };

  const handleTestFollowupFinished = () => {
    qc.invalidateQueries(['followup-tests']);
    qc.invalidateQueries(['dashboard']);
    qc.invalidateQueries(['notifications']);
    qc.invalidateQueries(['live-submissions-today']);
  };

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">Follow-ups</h1>

        {/* Minimal Tab Switcher */}
        <div className="inline-flex p-0.5 bg-gray-100 rounded-md text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('tests');
              setSearchParams({ tab: 'tests' });
            }}
            className={`px-3 py-1 font-medium rounded transition ${
              activeTab === 'tests' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Tests ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('general');
              setSearchParams({ tab: 'general' });
            }}
            className={`px-3 py-1 font-medium rounded transition ${
              activeTab === 'general' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Clients
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TESTS TAB                                                      */}
      {/* ============================================================== */}
      {activeTab === 'tests' && (
        <div className="space-y-2.5">
          {/* Quick Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Overdue Tests */}
            <div
              onClick={() => handleCardClick('overdue', () => setTestStatus(testStatus === 'overdue' ? '' : 'overdue'))}
              className={`p-3.5 rounded-lg border cursor-pointer select-none transition-all duration-200 transform active:scale-[0.98] ${
                animatingCard === 'overdue' ? 'animate-click-blue border-blue-400' : ''
              } ${
                testStatus === 'overdue'
                  ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-300/70 shadow-sm shadow-blue-100'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/20 active:bg-blue-100/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${
                  testStatus === 'overdue' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  <ExclamationTriangleIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{stats.overdue_count}</p>
                  <p className="text-xs text-gray-500 font-medium">Overdue</p>
                </div>
              </div>
            </div>

            {/* Due Tests */}
            <div
              onClick={() => handleCardClick('due', () => setTestStatus(testStatus === 'due' ? '' : 'due'))}
              className={`p-3.5 rounded-lg border cursor-pointer select-none transition-all duration-200 transform active:scale-[0.98] ${
                animatingCard === 'due' ? 'animate-click-blue border-blue-400' : ''
              } ${
                testStatus === 'due'
                  ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-300/70 shadow-sm shadow-blue-100'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/20 active:bg-blue-100/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${
                  testStatus === 'due' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  <ClockIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{stats.due_count}</p>
                  <p className="text-xs text-gray-500 font-medium">Due Today</p>
                </div>
              </div>
            </div>

            {/* Followed-up / Completed */}
            <div
              onClick={() => handleCardClick('completed', () => setTestStatus(testStatus === 'completed' ? '' : 'completed'))}
              className={`p-3.5 rounded-lg border cursor-pointer select-none transition-all duration-200 transform active:scale-[0.98] ${
                animatingCard === 'completed' ? 'animate-click-blue border-blue-400' : ''
              } ${
                testStatus === 'completed'
                  ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-300/70 shadow-sm shadow-blue-100'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/20 active:bg-blue-100/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${
                  testStatus === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  <CheckCircleIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{stats.completed_count}</p>
                  <p className="text-xs text-gray-500 font-medium">Followed Up</p>
                </div>
              </div>
            </div>

            {/* Submitter Breakdown */}
            <div className="p-3 rounded-lg border border-gray-200 bg-white flex flex-col justify-between">
              <span className="text-[11px] text-gray-400 font-medium">Submitters</span>
              <div className="flex items-center justify-between gap-2 mt-1">
                <div
                  onClick={() => handleCardClick('agent', () => setTestSubmitterType(testSubmitterType === 'agent' ? '' : 'agent'))}
                  className={`flex-1 py-1.5 px-2 rounded-md border text-center cursor-pointer select-none transition-all duration-200 transform active:scale-[0.96] ${
                    animatingCard === 'agent' ? 'animate-click-blue border-blue-400' : ''
                  } ${
                    testSubmitterType === 'agent'
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50/40 active:bg-blue-100/50'
                  }`}
                  title="Filter by Agents"
                >
                  <span className="text-[10px] block opacity-80">Agents</span>
                  <span className="text-sm font-bold">{stats.agent_count}</span>
                </div>
                <div
                  onClick={() => handleCardClick('asm', () => setTestSubmitterType(testSubmitterType === 'asm' ? '' : 'asm'))}
                  className={`flex-1 py-1.5 px-2 rounded-md border text-center cursor-pointer select-none transition-all duration-200 transform active:scale-[0.96] ${
                    animatingCard === 'asm' ? 'animate-click-blue border-blue-400' : ''
                  } ${
                    testSubmitterType === 'asm'
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50/40 active:bg-blue-100/50'
                  }`}
                  title="Filter by ASMs"
                >
                  <span className="text-[10px] block opacity-80">ASMs</span>
                  <span className="text-sm font-bold">{stats.asm_count}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Minimal Search input */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={testSearch}
              onChange={(e) => setTestSearch(e.target.value)}
              className="input pl-8 pr-7 h-8 text-xs bg-white w-full"
            />
            {testSearch && (
              <button
                type="button"
                onClick={() => setTestSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clean Test Rows */}
          {isTestsLoading ? (
            <div className="py-12 flex justify-center"><PageSpinner /></div>
          ) : tests.length === 0 ? (
            <div className="p-6 text-center bg-white border border-gray-200 rounded text-xs text-gray-400">
              No tests found.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded divide-y divide-gray-100">
              {tests.map((t) => {
                const isAsm = t.submitter_type === 'asm';
                const isCompleted = t.followup_status === 'completed';
                const isOverdue = t.followup_status === 'overdue';

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTest(t)}
                    className="p-3 hover:bg-blue-50/20 transition-all flex items-center justify-between gap-3 text-xs cursor-pointer group"
                    title="Click to view all test details"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Line 1: Status Badge & Test Type & Farmer */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {isCompleted ? (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                            Done
                          </span>
                        ) : isOverdue ? (
                          <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200/60 px-1.5 py-0.5 rounded">
                            {t.days_overdue}d Overdue
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded">
                            Due Today
                          </span>
                        )}

                        <span className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {t.test_type}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-700 font-medium">
                          {t.farmer_name}
                        </span>
                      </div>

                      {/* Line 2: Submitter & Date */}
                      <div className="text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
                        <span>{t.submitter_name} ({isAsm ? 'ASM' : 'Agent'})</span>
                        <span>·</span>
                        <span>{t.test_date}</span>
                        {isCompleted && t.followed_up_by_name && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-700 font-medium">Followed up by {t.followed_up_by_name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {!isCompleted ? (
                        <button
                          type="button"
                          onClick={() => setCompletingTest(t)}
                          className="btn-primary btn-sm h-7 px-2.5 text-xs flex items-center gap-1 shadow-2xs"
                        >
                          <CheckIcon className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          {t.followed_up_at ? new Date(t.followed_up_at).toLocaleDateString() : 'Done'}
                        </span>
                      )}
                      <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors ml-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Test Details Modal */}
          {selectedTest && (
            <TestDetailsModal
              test={selectedTest}
              onClose={() => setSelectedTest(null)}
              onCompleteClick={(testToComplete) => {
                setSelectedTest(null);
                setCompletingTest(testToComplete);
              }}
            />
          )}

          {/* Complete Followup Modal */}
          {completingTest && (
            <CompleteTestModal
              test={completingTest}
              onClose={() => setCompletingTest(null)}
              onComplete={handleTestFollowupFinished}
            />
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* GENERAL CLIENTS TAB                                            */}
      {/* ============================================================== */}
      {activeTab === 'general' && (
        <div className="space-y-2.5">
          <div className="flex justify-end">
            <button
              onClick={() => setGeneralAddModal(true)}
              className="btn-primary btn-sm text-xs flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>

          {isGeneralLoading ? (
            <div className="py-12 flex justify-center"><PageSpinner /></div>
          ) : generalData?.data?.length === 0 ? (
            <div className="p-6 text-center bg-white border border-gray-200 rounded text-xs text-gray-400">
              No follow-ups.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded divide-y divide-gray-100 text-xs">
              {generalData.data.map((f) => (
                <div key={f.id} className="p-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-gray-900">{f.title}</span>
                    <p className="text-gray-400 text-[11px] mt-0.5">
                      {f.company_name} · {f.followup_date} · {f.salesperson_name}
                    </p>
                  </div>
                  {f.status !== 'completed' && (
                    <button
                      onClick={() => setGeneralCompleteModal(f.id)}
                      className="btn-secondary btn-sm h-7 text-xs"
                    >
                      Complete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {generalData?.pagination && (
            <Pagination meta={generalData.pagination} onPageChange={setGeneralPage} />
          )}

          <CreateFollowupModal
            open={generalAddModal}
            onClose={() => setGeneralAddModal(false)}
            clients={clients}
            onCreate={() => qc.invalidateQueries(['followups'])}
          />

          <Modal open={Boolean(generalCompleteModal)} onClose={() => setGeneralCompleteModal(null)} title="Complete">
            <div className="space-y-3 text-xs">
              <textarea
                value={generalCompleteNotes}
                onChange={(e) => setGeneralCompleteNotes(e.target.value)}
                className="input text-xs"
                rows={2}
                placeholder="Notes..."
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setGeneralCompleteModal(null)} className="btn-secondary btn-sm">Cancel</button>
                <button onClick={handleGeneralComplete} className="btn-primary btn-sm">Save</button>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}
