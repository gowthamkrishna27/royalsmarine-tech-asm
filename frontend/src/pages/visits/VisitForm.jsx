import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { visitApi, clientApi, masterApi } from '../../services/api';
import { MEETING_TYPES } from '../../constants';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';
import { MapPinIcon } from '@heroicons/react/24/outline';

export default function VisitForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsAddress, setGpsAddress] = useState(null);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: { visit_date: new Date().toISOString().split('T')[0], visit_time: new Date().toTimeString().slice(0, 5) }
  });

  const { data: clients } = useQuery({ queryKey: ['clients-list'], queryFn: () => clientApi.list({ limit: 200, status: 'active' }).then(r => r.data.data) });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: () => masterApi.brands({ status: 'active' }).then(r => r.data.data) });

  const captureGPS = async () => {
    setGpsLoading(true);
    try {
      const { gpsService } = await import('../../services/gpsService');
      const pos = await gpsService.getCurrentCoordinates();
      const coords = { lat: pos.lat, lng: pos.lng };
      setGpsCoords(coords);
      setValue('latitude', coords.lat);
      setValue('longitude', coords.lng);
      setValue('gps_captured_at', pos.timestamp);

      const addr = await gpsService.reverseGeocode(coords.lat, coords.lng);
      setGpsAddress(addr);
      setValue('gps_address', addr);

      toast.success('Location captured');
    } catch {
      toast.error('Could not get location. Please enter GPS denied reason below.');
    } finally {
      setGpsLoading(false);
    }
  };

  const onSubmit = async (data) => {
    if (!gpsCoords && !data.gps_denied_reason) {
      toast.error('Please capture GPS or provide a reason for denial');
      return;
    }
    setLoading(true);
    try {
      const res = await visitApi.create(data);
      toast.success('Visit submitted successfully!');
      navigate(`/visits/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit visit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Add Visit Report</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-gray-900">Visit Details</h3></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Visit Date <span className="text-red-500">*</span></label>
              <input type="date" {...register('visit_date', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">Visit Time <span className="text-red-500">*</span></label>
              <input type="time" {...register('visit_time', { required: true })} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Farmer <span className="text-red-500">*</span></label>
              <select {...register('client_id', { required: 'Farmer required' })} className={`input ${errors.client_id ? 'input-error' : ''}`}>
                <option value="">Select farmer...</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.company_name} — {c.city}</option>)}
              </select>
              {errors.client_id && <p className="form-error">{errors.client_id.message}</p>}
            </div>
            <div>
              <label className="label">Meeting Type <span className="text-red-500">*</span></label>
              <select {...register('meeting_type', { required: true })} className="input">
                {MEETING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Person Met</label>
              <input {...register('person_met')} className="input" placeholder="Name of person" />
            </div>
            <div>
              <label className="label">Their Designation</label>
              <input {...register('designation_met')} className="input" />
            </div>
          </div>
        </div>

        {/* GPS */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Location</h3>
            <button type="button" onClick={captureGPS} disabled={gpsLoading} className="btn-primary btn-sm">
              {gpsLoading ? <Spinner size="sm" /> : <MapPinIcon className="w-4 h-4" />}
              {gpsCoords ? 'Recapture GPS' : 'Capture GPS'}
            </button>
          </div>
          <div className="card-body">
            {gpsCoords ? (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                <p className="font-medium">✓ Location captured</p>
                {gpsAddress && <p className="text-xs mt-1 text-green-600">{gpsAddress}</p>}
                <p className="text-xs mt-0.5 text-green-500">{gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}</p>
              </div>
            ) : (
              <div>
                <label className="label">GPS Denied Reason (if location unavailable)</label>
                <input {...register('gps_denied_reason')} className="input" placeholder="e.g. Indoor location, device GPS off" />
              </div>
            )}
          </div>
        </div>

        {/* Meeting Notes */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-gray-900">Meeting Notes</h3></div>
          <div className="card-body space-y-4">
            <div>
              <label className="label">Meeting Highlights</label>
              <textarea {...register('meeting_highlights')} className="input" rows={3} placeholder="Key discussion points..." />
            </div>
            <div>
              <label className="label">Visit Outcome</label>
              <textarea {...register('visit_outcome')} className="input" rows={2} placeholder="What was achieved..." />
            </div>
            <div>
              <label className="label">Next Action</label>
              <input {...register('next_action')} className="input" placeholder="What needs to happen next..." />
            </div>
            <div>
              <label className="label">Next Follow-up Date</label>
              <input type="date" {...register('next_followup_date')} className="input" />
            </div>
            <div>
              <label className="label">Remarks</label>
              <textarea {...register('remarks')} className="input" rows={2} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end sm:pr-20 pb-8 sm:pb-12">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <><Spinner size="sm" /> Submitting...</> : 'Submit Visit Report'}
          </button>
        </div>
      </form>
    </div>
  );
}
