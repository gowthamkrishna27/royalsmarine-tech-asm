import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { followupApi, clientApi } from '../../services/api';

export default function CreateFollowupModal({ open, onClose, clients, users, currentUser, onCreate }) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [selectedExecId, setSelectedExecId] = useState('');
  const [showAllFarmers, setShowAllFarmers] = useState(false);
  const [testRequired, setTestRequired] = useState(false);
  const [tankId, setTankId] = useState('');
  const [ponds, setPonds] = useState([]);
  const [loadingPonds, setLoadingPonds] = useState(false);

  const isASM = currentUser?.role === 'sales_manager';
  const selectedClientId = watch('client_id');

  // Load ponds when a farmer is selected
  useEffect(() => {
    if (selectedClientId) {
      setLoadingPonds(true);
      clientApi
        .listPonds(selectedClientId)
        .then((res) => {
          setPonds(res.data?.data || []);
        })
        .catch(() => {
          setPonds([]);
        })
        .finally(() => setLoadingPonds(false));
    } else {
      setPonds([]);
      setTankId('');
    }
  }, [selectedClientId]);

  // Filter farmers assigned to the selected technical executive / ASM
  const filteredClients = (clients || []).filter((c) => {
    if (!selectedExecId) return false;
    return String(c.assigned_salesperson_id) === String(selectedExecId);
  });

  const displayFarmers = showAllFarmers || filteredClients.length === 0
    ? (clients || [])
    : filteredClients;

  const handleExecChange = (e) => {
    const val = e.target.value;
    setSelectedExecId(val);
    setValue('assigned_salesperson_id', val);
    setValue('client_id', '');
    setShowAllFarmers(false);
    setPonds([]);
    setTankId('');
  };

  const onSubmit = async (formData) => {
    setLoading(true);
    try {
      await followupApi.create({
        ...formData,
        assigned_salesperson_id: selectedExecId || currentUser?.id,
        test_required: testRequired ? 1 : 0,
        tank_id: testRequired && tankId ? Number(tankId) : null,
      });
      toast.success('Follow-up scheduled successfully');
      reset();
      setSelectedExecId('');
      setTestRequired(false);
      setTankId('');
      setPonds([]);
      onClose();
      if (onCreate) onCreate();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create follow-up');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    reset();
    setSelectedExecId('');
    setShowAllFarmers(false);
    setTestRequired(false);
    setTankId('');
    setPonds([]);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleModalClose} title="Create Follow-up" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* 1. Title */}
        <div>
          <label className="label">Title <span className="text-red-500">*</span></label>
          <input
            {...register('title', { required: 'Title is required' })}
            className="input"
            placeholder="e.g. Water Quality Review & Stock Assessment"
          />
          {errors.title && <p className="form-error">{errors.title.message}</p>}
        </div>

        {/* 2. Assigned Executive (ASM or Technical Executive) */}
        <div>
          <label className="label">
            Assigned Executive <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedExecId}
            onChange={handleExecChange}
            className="input font-medium"
            required
          >
            <option value="">Select Technical Executive or ASM</option>
            {isASM && currentUser && (
              <option value={currentUser.id}>
                Myself ({currentUser.full_name}) - ASM
              </option>
            )}
            {(users || [])
              .filter((u) => u.status === 'active' && ['sales_manager', 'sales_executive'].includes(u.role))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role_display || (u.role === 'sales_manager' ? 'ASM' : 'Technical Executive')})
                </option>
              ))}
          </select>
        </div>

        {/* 3. Farmer of the selected Executive */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">
              Farmer <span className="text-red-500">*</span>
            </label>
            {selectedExecId && filteredClients.length > 0 && !showAllFarmers && (
              <span className="text-xs text-blue-600 font-medium">
                {filteredClients.length} {filteredClients.length === 1 ? 'farmer' : 'farmers'} available
              </span>
            )}
          </div>

          <select
            {...register('client_id', { required: 'Please select a farmer' })}
            className="input"
            disabled={!selectedExecId}
          >
            <option value="">
              {!selectedExecId
                ? 'Select Executive first'
                : displayFarmers.length === 0
                  ? 'No farmers found for this executive'
                  : 'Select farmer'}
            </option>
            {displayFarmers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name} {c.city ? `(${c.city})` : ''}
              </option>
            ))}
          </select>
          {errors.client_id && <p className="form-error">{errors.client_id.message}</p>}

          {selectedExecId && filteredClients.length === 0 && !showAllFarmers && (
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-amber-600">No farmers mapped to this executive.</span>
              <button
                type="button"
                onClick={() => setShowAllFarmers(true)}
                className="text-blue-600 hover:underline font-semibold ml-2 shrink-0"
              >
                Show all farmers ({clients?.length || 0})
              </button>
            </div>
          )}
        </div>

        {/* Minimal Water Test Requirement */}
        <div className="space-y-2 pt-1">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-gray-700 hover:text-gray-900">
            <input
              type="checkbox"
              checked={testRequired}
              onChange={(e) => setTestRequired(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Water test required on completion</span>
          </label>

          {testRequired && (
            <div className="pl-6">
              <select
                value={tankId}
                onChange={(e) => setTankId(e.target.value)}
                className="input text-xs py-1.5"
                disabled={!selectedClientId || loadingPonds}
              >
                <option value="">
                  {!selectedClientId
                    ? 'Select Farmer first'
                    : loadingPonds
                    ? 'Loading ponds...'
                    : 'Target Pond / Tank (Optional)'}
                </option>
                {ponds.map((p) => {
                  const label =
                    p.pond_name && p.tank_number && String(p.pond_name).trim() !== String(p.tank_number).trim() && !String(p.pond_name).includes(String(p.tank_number))
                      ? `${p.pond_name} (#${p.tank_number})`
                      : (p.pond_name || `Tank #${p.tank_number || p.id}`);
                  return (
                    <option key={p.id} value={p.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* 4. Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Date <span className="text-red-500">*</span></label>
            <input type="date" {...register('followup_date', { required: 'Date is required' })} className="input" />
            {errors.followup_date && <p className="form-error">{errors.followup_date.message}</p>}
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" {...register('followup_time')} className="input" />
          </div>
        </div>

        {/* 5. Priority */}
        <div>
          <label className="label">Priority</label>
          <select {...register('priority')} defaultValue="medium" className="input">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* 6. Remarks */}
        <div>
          <label className="label">Remarks</label>
          <textarea {...register('remarks')} className="input" rows={2} placeholder="Optional instructions or notes..." />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 sm:gap-3 justify-end pt-2">
          <button type="button" onClick={handleModalClose} className="btn-secondary flex-1 sm:flex-initial py-2 sm:py-1.5">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 sm:flex-initial py-2 sm:py-1.5">
            {loading ? 'Creating...' : 'Create Follow-up'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
