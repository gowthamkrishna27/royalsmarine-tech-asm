import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { visitApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Badge from '../../components/common/Badge';
import { MEETING_TYPES } from '../../constants';
import {
  ArrowLeftIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  BeakerIcon,
  ScaleIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CircleStackIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';

const WATER_PARAMS = [
  { key: 'ph', label: 'pH', unit: '', ideal: '7.5 - 8.5' },
  { key: 'salinity', label: 'Salinity', unit: 'ppt', ideal: '10 - 25' },
  { key: 'alkalinity', label: 'Alkalinity', unit: 'ppm', ideal: '100 - 150' },
  { key: 'hardness', label: 'Hardness', unit: 'ppm', ideal: '2000 - 4000' },
  { key: 'dissolved_oxygen', label: 'Dissolved Oxygen (DO)', unit: 'ppm', ideal: '> 4.0' },
  { key: 'ammonia', label: 'Ammonia (NH3)', unit: 'ppm', ideal: '< 0.1' },
  { key: 'nitrite', label: 'Nitrite (NO2)', unit: 'ppm', ideal: '< 0.2' },
  { key: 'hydrogen_sulphide', label: 'Hydrogen Sulphide (H2S)', unit: 'ppm', ideal: '0.0' },
  { key: 'potassium', label: 'Potassium (K)', unit: 'ppm', ideal: '300 - 450' },
  { key: 'chlorine', label: 'Chlorine', unit: 'ppm', ideal: '0.0' },
  { key: 'iron', label: 'Iron (Fe)', unit: 'ppm', ideal: '< 0.3' },
];

export default function VisitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: visit, isLoading } = useQuery({
    queryKey: ['visit', id],
    queryFn: () => visitApi.get(id).then((r) => r.data.data),
  });

  if (isLoading) return <PageSpinner />;
  if (!visit) {
    return (
      <div className="card p-8 text-center space-y-3">
        <ExclamationTriangleIcon className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-base font-semibold text-gray-900">Visit Log Not Found</h2>
        <p className="text-sm text-gray-500">The visit log you are looking for does not exist or has been deleted.</p>
        <button type="button" onClick={() => navigate('/visits')} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Visits
        </button>
      </div>
    );
  }

  const wq = visit.water_quality || {};
  const fd = visit.feeding_details || {};
  const meds = Array.isArray(visit.medication_details) ? visit.medication_details : [];
  const hd = visit.harvest_details || {};
  const partialHarvests = Array.isArray(hd.partial_harvests) ? hd.partial_harvests : [];
  const finalHarvest = hd.final_harvest || null;

  const meetingTypeLabel = MEETING_TYPES.find((t) => t.value === visit.meeting_type)?.label || visit.meeting_type;

  const hasWaterQuality = Object.keys(wq).some((k) => wq[k] !== '' && wq[k] !== null && wq[k] !== undefined);
  const hasFeeding = Object.keys(fd).some((k) => fd[k] !== '' && fd[k] !== null && fd[k] !== undefined);
  const hasMedication = meds.length > 0;
  const hasHarvest = partialHarvests.length > 0 || (finalHarvest && Object.keys(finalHarvest).some((k) => finalHarvest[k]));

  return (
    <div className="space-y-6 fade-in max-w-5xl mx-auto pb-12">
      {/* Top Navigation & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/visits')}
          className="btn-secondary btn-sm self-start inline-flex items-center gap-1.5 active:scale-95 transition"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Back to Visit Logs
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md font-medium">
            Read-Only Report
          </span>
          {visit.approval_status === 'approved' ? (
            <Badge color="green" className="flex items-center gap-1">
              <CheckCircleIcon className="w-3.5 h-3.5" /> Approved
              {visit.approved_by_name ? ` by ${visit.approved_by_name}` : ''}
            </Badge>
          ) : visit.approval_status === 'rejected' ? (
            <Badge color="red" className="flex items-center gap-1">
              <XCircleIcon className="w-3.5 h-3.5" /> Rejected
            </Badge>
          ) : (
            <Badge color="yellow" className="flex items-center gap-1">
              <ClockIcon className="w-3.5 h-3.5" /> Pending Review
            </Badge>
          )}
        </div>
      </div>

      {/* Rejection Alert if Rejected */}
      {visit.approval_status === 'rejected' && visit.rejection_reason && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 text-sm flex items-start gap-3">
          <XCircleIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Visit Submission Rejected</p>
            <p className="text-xs text-red-700 mt-0.5">Reason: {visit.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* Main Header Card */}
      <div className="card p-5 sm:p-6 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/30 border-blue-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                {visit.company_name}
              </h1>
              {visit.tank_number && (
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full flex items-center gap-1">
                  <CircleStackIcon className="w-3.5 h-3.5" /> {visit.tank_number}
                </span>
              )}
              <Badge color="blue">{meetingTypeLabel}</Badge>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 flex items-center gap-1.5">
              <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{[visit.city, visit.state].filter(Boolean).join(', ') || 'Farmer Location'}</span>
            </p>
          </div>

          {visit.client_id && (
            <Link
              to={`/clients/${visit.client_id}`}
              className="btn-secondary btn-sm self-start md:self-auto shrink-0 flex items-center gap-1.5"
            >
              <UserIcon className="w-4 h-4" /> View Farmer Profile
            </Link>
          )}
        </div>

        {/* Key Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-gray-100 text-xs">
          <div>
            <span className="text-gray-400 block font-medium">Conducted By</span>
            <span className="text-gray-900 font-semibold text-sm flex items-center gap-1 mt-0.5">
              <UserIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{visit.salesperson_name || 'Technical Executive'}</span>
            </span>
          </div>
          <div>
            <span className="text-gray-400 block font-medium">Date & Time</span>
            <span className="text-gray-900 font-semibold text-sm flex items-center gap-1 mt-0.5">
              <CalendarIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{visit.visit_date} {visit.visit_time ? `(${visit.visit_time})` : ''}</span>
            </span>
          </div>
          <div>
            <span className="text-gray-400 block font-medium">Person Met</span>
            <span className="text-gray-900 font-semibold text-sm block truncate mt-0.5">
              {visit.person_met || '—'} {visit.designation_met ? `(${visit.designation_met})` : ''}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block font-medium">GPS Captured</span>
            {visit.latitude && visit.longitude ? (
              <a
                href={`https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline font-semibold text-sm flex items-center gap-1 mt-0.5"
              >
                <MapPinIcon className="w-3.5 h-3.5 shrink-0" /> View on Map
              </a>
            ) : (
              <span className="text-gray-400 font-medium block mt-0.5">Not recorded</span>
            )}
          </div>
        </div>

        {visit.gps_address && (
          <p className="text-[11px] text-gray-500 mt-2 bg-white/70 p-2 rounded-lg border border-gray-100">
            <span className="font-semibold text-gray-700">GPS Address:</span> {visit.gps_address}
          </p>
        )}
      </div>

      {/* SECTION 1: WATER QUALITY TEST DETAILS */}
      <div className="card overflow-hidden">
        <div className="card-header bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <BeakerIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Water Quality Test Parameters</h2>
              <p className="text-[11px] text-gray-500">Pond water chemical parameters tested on site</p>
            </div>
          </div>
          {wq.doc && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
              DOC: {wq.doc} Days
            </span>
          )}
        </div>

        <div className="p-4 sm:p-5">
          {!hasWaterQuality ? (
            <p className="text-xs text-gray-400 text-center py-6">No water quality tests were recorded for this visit.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {WATER_PARAMS.map((param) => {
                  const val = wq[param.key];
                  const hasVal = val !== '' && val !== null && val !== undefined;
                  return (
                    <div
                      key={param.key}
                      className={`p-3 rounded-xl border transition-all ${
                        hasVal ? 'bg-white border-gray-200 shadow-xs' : 'bg-gray-50/50 border-gray-100 opacity-60'
                      }`}
                    >
                      <span className="text-[11px] font-medium text-gray-500 block truncate">{param.label}</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className={`text-base font-bold ${hasVal ? 'text-gray-900 font-mono' : 'text-gray-400'}`}>
                          {hasVal ? val : '—'}
                        </span>
                        {hasVal && param.unit && <span className="text-xs text-gray-500">{param.unit}</span>}
                      </div>
                      <span className="text-[10px] text-gray-400 block mt-0.5">Ideal: {param.ideal}</span>
                    </div>
                  );
                })}

                <div className="p-3 rounded-xl border bg-white border-gray-200 shadow-xs">
                  <span className="text-[11px] font-medium text-gray-500 block">Water Colour</span>
                  <p className="text-sm font-bold text-gray-900 mt-1">{wq.water_colour || '—'}</p>
                  <span className="text-[10px] text-gray-400 block mt-0.5">Visual Observation</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: FEEDING & GROWTH DETAILS */}
      <div className="card overflow-hidden">
        <div className="card-header bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ScaleIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Feeding & Growth Performance</h2>
              <p className="text-[11px] text-gray-500">Biomass calculations, check tray observation, and FCR</p>
            </div>
          </div>
          {fd.fcr && (
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg">
              FCR: {fd.fcr}
            </span>
          )}
        </div>

        <div className="p-4 sm:p-5">
          {!hasFeeding ? (
            <p className="text-xs text-gray-400 text-center py-6">No feeding or growth observations recorded for this visit.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-gray-500 block text-[11px]">Days of Culture (DOC)</span>
                  <span className="text-sm sm:text-base font-bold text-gray-900 font-mono mt-0.5 block">
                    {fd.doc ? `${fd.doc} Days` : '—'}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-gray-500 block text-[11px]">Seed Stocking Quantity</span>
                  <span className="text-sm sm:text-base font-bold text-gray-900 font-mono mt-0.5 block">
                    {fd.seed_quantity ? `${fd.seed_quantity} Lakhs` : '—'}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-gray-500 block text-[11px]">Average Body Weight (ABW)</span>
                  <span className="text-sm sm:text-base font-bold text-gray-900 font-mono mt-0.5 block">
                    {fd.abw ? `${fd.abw} g` : '—'}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <span className="text-emerald-700 block text-[11px] font-semibold">Feed Conversion Ratio</span>
                  <span className="text-sm sm:text-base font-bold text-emerald-900 font-mono mt-0.5 block">
                    {fd.fcr || '—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-xs">
                  <span className="text-gray-500 block text-[11px]">Daily Feed Quantity</span>
                  <span className="text-sm font-bold text-gray-900 font-mono mt-0.5 block">
                    {fd.daily_feed_quantity ? `${fd.daily_feed_quantity} kg` : '—'}
                  </span>
                </div>
                <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-xs">
                  <span className="text-gray-500 block text-[11px]">Cumulative Feed</span>
                  <span className="text-sm font-bold text-gray-900 font-mono mt-0.5 block">
                    {fd.cumulative_feed ? `${fd.cumulative_feed} kg` : '—'}
                  </span>
                </div>
                <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-xs">
                  <span className="text-gray-500 block text-[11px]">Total Biomass</span>
                  <span className="text-sm font-bold text-gray-900 font-mono mt-0.5 block">
                    {fd.total_biomass ? `${fd.total_biomass} kg` : '—'}
                  </span>
                </div>
              </div>

              {(fd.check_tray_feed_quantity || fd.check_tray_observation_time || fd.remarks) && (
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1.5">
                  <p className="font-semibold text-gray-800">Check Tray & Feeding Observations</p>
                  <div className="flex flex-wrap gap-4 text-gray-600">
                    {fd.check_tray_feed_quantity && (
                      <span>Check Tray Feed: <strong className="text-gray-900">{fd.check_tray_feed_quantity}</strong></span>
                    )}
                    {fd.check_tray_observation_time && (
                      <span>Observation Time: <strong className="text-gray-900">{fd.check_tray_observation_time}</strong></span>
                    )}
                  </div>
                  {fd.remarks && <p className="text-gray-600 mt-1 italic">"{fd.remarks}"</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: MEDICATION & POND TREATMENTS */}
      <div className="card overflow-hidden">
        <div className="card-header bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
              <ClipboardDocumentCheckIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Medication & Chemical Treatments</h2>
              <p className="text-[11px] text-gray-500">Probiotics, minerals, feed supplements, and disease control</p>
            </div>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {meds.length} {meds.length === 1 ? 'treatment' : 'treatments'} recorded
          </span>
        </div>

        <div className="p-4 sm:p-5">
          {!hasMedication ? (
            <p className="text-xs text-gray-400 text-center py-6">No medications or chemical treatments recorded for this visit.</p>
          ) : (
            <div className="space-y-3">
              {meds.map((m, index) => (
                <div key={index} className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-xs space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">{m.product_name || 'Product'}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          m.treatment_type === 'curative' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {m.treatment_type || 'Preventive'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[11px] font-medium capitalize">
                      {m.category?.replace(/_/g, ' ') || 'General'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-gray-100 text-gray-600">
                    <div>
                      <span className="text-gray-400 text-[10px] block">Dosage</span>
                      <span className="font-semibold text-gray-900">{m.dosage || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Disease / Symptom</span>
                      <span className="font-medium text-gray-800">{m.disease_identification || 'None identified'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Remarks</span>
                      <span className="text-gray-600 italic">{m.remarks || '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: HARVEST DETAILS (If available) */}
      {hasHarvest && (
        <div className="card overflow-hidden">
          <div className="card-header bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <DocumentTextIcon className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">Harvest Details & Survival</h2>
            </div>
          </div>
          <div className="p-4 sm:p-5 space-y-4">
            {partialHarvests.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Partial Harvests</p>
                <div className="table-container border border-gray-200 rounded-lg">
                  <table className="table text-xs">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>DOC</th>
                        <th>ABW (g)</th>
                        <th>Quantity (pcs)</th>
                        <th>Biomass (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partialHarvests.map((ph, idx) => (
                        <tr key={idx}>
                          <td>{ph.date || '—'}</td>
                          <td>{ph.doc || '—'}</td>
                          <td>{ph.abw || '—'}</td>
                          <td>{ph.harvested_quantity || '—'}</td>
                          <td className="font-bold">{ph.harvested_biomass || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {finalHarvest && Object.keys(finalHarvest).some((k) => finalHarvest[k]) && (
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl text-xs">
                <p className="font-bold text-amber-900 mb-2">Final Harvest</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-gray-700">
                  <div>Date: <strong className="text-gray-900">{finalHarvest.date || '—'}</strong></div>
                  <div>DOC: <strong className="text-gray-900">{finalHarvest.doc || '—'}</strong></div>
                  <div>ABW: <strong className="text-gray-900">{finalHarvest.abw || '—'} g</strong></div>
                  <div>Quantity: <strong className="text-gray-900">{finalHarvest.harvested_quantity || '—'}</strong></div>
                  <div>Biomass: <strong className="text-gray-900 font-bold">{finalHarvest.harvested_biomass || '—'} kg</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: NOTES & ACTION ITEMS */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
          Meeting Highlights & Recommendations
        </h3>
        <div className="space-y-3 text-xs">
          <div>
            <span className="text-gray-400 font-medium block">Discussion Highlights</span>
            <p className="text-gray-800 text-sm mt-0.5 whitespace-pre-line bg-gray-50 p-3 rounded-lg border border-gray-100">
              {visit.meeting_highlights || 'No highlights recorded.'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-gray-400 font-medium block">Visit Outcome</span>
              <span className="text-gray-900 font-semibold text-sm mt-0.5 block">{visit.visit_outcome || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 font-medium block">Next Action Plan</span>
              <span className="text-gray-900 font-semibold text-sm mt-0.5 block">{visit.next_action || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 font-medium block">Next Follow-up Date</span>
              <span className="text-gray-900 font-semibold text-sm mt-0.5 block">{visit.next_followup_date || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
