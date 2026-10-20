import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { clientApi, visitApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Badge from '../../components/common/Badge';
import { CLIENT_TYPES } from '../../constants';
import { PhoneIcon, EnvelopeIcon, MapPinIcon, PencilIcon } from '@heroicons/react/24/outline';

const CLIENT_TYPE_COLOR = { existing_client: 'green', new_prospect: 'blue', retailer: 'orange', corporate: 'purple', distributor: 'indigo', government: 'yellow', other: 'gray' };

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs font-medium text-gray-500 w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value}</span>
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isExec = user?.role === 'sales_executive';

  const { data: profile, isLoading } = useQuery({
    queryKey: ['client-profile', id],
    queryFn: () => clientApi.profile(id).then(r => r.data.data),
  });
  const { data: visits } = useQuery({
    queryKey: ['client-visits', id],
    queryFn: () => visitApi.list({ client_id: id, limit: 5 }).then(r => r.data.data),
  });

  if (isLoading) return <PageSpinner />;
  if (!profile) return <div className="text-center py-16 text-gray-500">Farmer not found</div>;

  const c = profile;

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="page-title">{c.company_name}</h1>
            <Badge color={CLIENT_TYPE_COLOR[c.client_type] || 'gray'}>
              {CLIENT_TYPES.find(t => t.value === c.client_type)?.label || 'Farmer'}
            </Badge>
            <Badge color={c.status === 'active' ? 'green' : 'red'}>{c.status}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            {[c.village, c.area, c.city].filter(Boolean).join(' · ') || 'Aquaculture Farmer'}
          </p>
        </div>
        <Link to={`/clients/${id}/edit`} className="btn-secondary btn-sm">
          <PencilIcon className="w-4 h-4" /> Edit Farmer
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {c.farm_extent_acres ? `${c.farm_extent_acres}` : (c.stats?.total_acres || '-')}
          </p>
          <p className="text-xs text-gray-500 mt-1">Farm Extent (Acres)</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {c.number_of_tanks || (c.ponds?.length || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Number of Tanks</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{c.stats?.visit_count || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Total Visits</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Basic Information */}
        <div className="card lg:col-span-1">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Basic Information</h3>
          </div>
          <div className="card-body">
            <InfoRow label="Farmer Name" value={c.company_name} />
            {c.mobile && (
              <div className="flex items-center gap-2 py-2 border-b border-gray-50">
                <PhoneIcon className="w-4 h-4 text-gray-400" />
                <a href={`tel:${c.mobile}`} className="text-sm text-blue-600 font-medium">{c.mobile}</a>
              </div>
            )}
            <InfoRow label="Area / Mandal" value={c.area} />
            <InfoRow label="Village" value={c.village} />
            <InfoRow label="Farm Extent" value={c.farm_extent_acres ? `${c.farm_extent_acres} Acres` : null} />
            <InfoRow label="Tanks" value={c.number_of_tanks ? `${c.number_of_tanks} Tanks` : null} />

            {c.alternate_mobile && <InfoRow label="Alt Phone" value={c.alternate_mobile} />}
            {c.contact_person && <InfoRow label="Contact Person" value={c.contact_person} />}
            {c.email && (
              <div className="flex items-center gap-2 py-2 border-b border-gray-50">
                <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                <a href={`mailto:${c.email}`} className="text-sm text-blue-600">{c.email}</a>
              </div>
            )}
            {c.address && (
              <div className="flex items-start gap-2 py-2 border-b border-gray-50">
                <MapPinIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                <span className="text-sm text-gray-700">{c.address}</span>
              </div>
            )}
            {c.latitude && c.longitude && (
              <div className="py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 block mb-0.5">Farm Location</span>
                <a
                  href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  GPS: {Number(c.latitude).toFixed(5)}, {Number(c.longitude).toFixed(5)} ↗
                </a>
              </div>
            )}
            <InfoRow label="Salesperson" value={c.salesperson_name} />
            {c.notes && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                <strong>Notes:</strong> {c.notes}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tanks & Recent Visits */}
        <div className="card lg:col-span-2 space-y-6">
          {/* Tank Information */}
          <div>
            <div className="card-header flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Tank Information</h3>
                <p className="text-xs text-gray-500">{c.ponds?.length || 0} tanks listed</p>
              </div>
              <Link to={`/clients/${id}/edit`} className="text-xs text-blue-600 hover:underline">
                Manage Tanks
              </Link>
            </div>

            <div className="p-4 space-y-3">
              {!c.ponds || c.ponds.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No tanks recorded yet</p>
              ) : (
                c.ponds.map((p, idx) => (
                  <div key={p.id || idx} className="p-3.5 border border-gray-100 rounded-lg bg-gray-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {p.tank_number || p.pond_name || `Tank ${idx + 1}`}
                        </span>
                        {(p.tank_size || p.area_acres) && (
                          <span className="text-xs text-gray-600 font-medium">
                            · {p.tank_size || p.area_acres} Acres
                          </span>
                        )}
                        {p.salinity !== null && p.salinity !== undefined && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                            {p.salinity} ppt
                          </span>
                        )}
                      </div>
                      <Badge color={p.status === 'active' ? 'green' : 'gray'}>
                        {p.status || 'Active'}
                      </Badge>
                    </div>

                    {/* Detailed Attributes */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-600 pt-1">
                      {p.soil_type && (
                        <div>
                          <span className="text-gray-400">Soil:</span>{' '}
                          <span className="font-medium text-gray-800 capitalize">{p.soil_type}</span>
                        </div>
                      )}
                      {p.hatchery_name && (
                        <div>
                          <span className="text-gray-400">Hatchery:</span>{' '}
                          <span className="font-medium text-gray-800">{p.hatchery_name}</span>
                        </div>
                      )}
                      {p.brooder && (
                        <div>
                          <span className="text-gray-400">Brooder:</span>{' '}
                          <span className="font-medium text-gray-800">{p.brooder}</span>
                        </div>
                      )}
                      {p.seed_date && (
                        <div>
                          <span className="text-gray-400">Seed Date:</span>{' '}
                          <span className="font-medium text-gray-800">{p.seed_date.substring(0, 10)}</span>
                        </div>
                      )}
                      {p.stocking_quantity_lakhs !== null && p.stocking_quantity_lakhs !== undefined && (
                        <div>
                          <span className="text-gray-400">Stocking:</span>{' '}
                          <span className="font-medium text-gray-800">{p.stocking_quantity_lakhs} Lakhs</span>
                        </div>
                      )}
                      {p.feed_type && (
                        <div>
                          <span className="text-gray-400">Feed:</span>{' '}
                          <span className="font-medium text-gray-800">{p.feed_type}</span>
                        </div>
                      )}
                    </div>

                    {/* GPS Coordinates & Google Maps */}
                    {p.latitude && p.longitude && (
                      <div className="pt-1 flex items-center justify-between text-xs border-t border-gray-100">
                        <span className="text-gray-400">
                          GPS: {Number(p.latitude).toFixed(5)}, {Number(p.longitude).toFixed(5)}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Directions ↗
                        </a>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Visits */}
          <div>
            <div className="card-header border-t border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Recent Visits</h3>
              <Link to={`/visits?client_id=${id}`} className="text-xs text-blue-600 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {visits?.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No visits yet</p>}
              {visits?.map(v => (
                <div key={v.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <Link to={`/visits/${v.id}`} className="text-sm font-medium text-gray-800 hover:text-blue-600">
                      {v.meeting_type?.replace(/_/g, ' ') || 'Visit'}
                    </Link>
                    <p className="text-xs text-gray-500">{v.visit_date} · {v.person_met || 'Farmer'}</p>
                  </div>
                  <Link to={`/visits/${v.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
