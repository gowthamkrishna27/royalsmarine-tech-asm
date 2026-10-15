import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clientService from '../../services/clientService';
import { PageSpinner } from '../../components/common/Spinner';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import SubmitTestModal from '../../components/map/SubmitTestModal';
import {
  BeakerIcon,
  PlusIcon,
  ArrowPathIcon,
  MapPinIcon,
  FunnelIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const getL = () => (typeof window !== 'undefined' ? window.L : null);

export default function MapPage() {
  const queryClient = useQueryClient();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markerMapRef = useRef(new Map());

  // Filter States
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [submitterFilter, setSubmitterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLeafletReady, setIsLeafletReady] = useState(Boolean(typeof window !== 'undefined' && window.L));

  // Modal State
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [newlySubmittedId, setNewlySubmittedId] = useState(null);

  // Poll for Leaflet CDN script if loading
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L) {
      setIsLeafletReady(true);
      return;
    }
    const timer = setInterval(() => {
      if (typeof window !== 'undefined' && window.L) {
        setIsLeafletReady(true);
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Fetch map locations with tests included
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['map-locations'],
    queryFn: () => clientService.getMapLocations().then(res => res.data.data),
    refetchInterval: 20000, // Auto-refresh every 20s to capture live agent/asm submissions
  });

  const clients = data?.clients || [];
  const ponds = data?.ponds || [];
  const tests = data?.tests || [];

  // Mappable items with valid coordinates
  const items = useMemo(() => {
    const list = [];

    // 1. Farmers
    clients.forEach(c => {
      const lat = parseFloat(c.latitude);
      const lng = parseFloat(c.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        list.push({
          id: `farmer-${c.id}`,
          rawId: c.id,
          type: 'farmer',
          name: c.company_name,
          contact_person: c.contact_person,
          mobile: c.mobile,
          city: c.city,
          state: c.state,
          address: c.address || c.gps_address,
          latitude: lat,
          longitude: lng,
        });
      }
    });

    // 2. Ponds
    ponds.forEach(p => {
      const lat = parseFloat(p.latitude);
      const lng = parseFloat(p.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        const parentFarmer = clients.find(c => c.id === p.client_id);
        list.push({
          id: `pond-${p.id}`,
          rawId: p.id,
          clientId: p.client_id,
          type: 'pond',
          name: p.pond_name,
          farmer_name: parentFarmer?.company_name,
          mobile: parentFarmer?.mobile,
          area_acres: p.area_acres || p.area,
          culture_type: p.culture_type,
          address: p.gps_address,
          latitude: lat,
          longitude: lng,
        });
      }
    });

    // 3. Tests submitted by Agent or ASM
    tests.forEach(t => {
      const lat = parseFloat(t.latitude);
      const lng = parseFloat(t.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        const isAsm =
          t.submitter_type === 'asm' ||
          (t.submitter_role && (
            t.submitter_role.toLowerCase().includes('asm') ||
            t.submitter_role.toLowerCase().includes('manager')
          ));

        let parsedParams = t.parameters;
        if (typeof parsedParams === 'string') {
          try {
            parsedParams = JSON.parse(parsedParams);
          } catch {
            parsedParams = null;
          }
        }

        list.push({
          id: `test-${t.id}`,
          rawId: t.id,
          type: 'test',
          submitterCategory: isAsm ? 'asm' : 'agent',
          testType: t.test_type || 'Water Quality Analysis',
          submitterName: t.submitter_name || 'Field Executive',
          submitterRole: t.submitter_role || (isAsm ? 'Area Sales Manager' : 'Technical Executive'),
          agentId: t.agent_id || '',
          farmerId: t.farmer_id,
          farmerName: t.farmer_name || 'Farmer',
          farmerMobile: t.farmer_mobile || '',
          tankId: t.tank_id,
          tankName: t.tank_name || 'Main Pond',
          locality: t.locality || 'Field Location',
          date: t.date,
          submissionTime: t.submission_time,
          status: (t.status || 'PENDING_VERIFICATION').toUpperCase(),
          parameters: parsedParams,
          accuracy: t.accuracy,
          notes: t.notes,
          createdAt: t.created_at,
          latitude: lat,
          longitude: lng,
        });
      }
    });

    return list;
  }, [clients, ponds, tests]);

  // Unique list of test submitters for filter dropdown
  const uniqueSubmitters = useMemo(() => {
    const map = new Map();
    items
      .filter(i => i.type === 'test')
      .forEach(i => {
        if (!map.has(i.submitterName)) {
          map.set(i.submitterName, {
            name: i.submitterName,
            role: i.submitterRole,
            category: i.submitterCategory,
          });
        }
      });
    return Array.from(map.values());
  }, [items]);

  // Filtered items
  const filtered = useMemo(() => {
    return items.filter(item => {
      // Type Filter
      if (typeFilter) {
        if (typeFilter === 'farmer' && item.type !== 'farmer') return false;
        if (typeFilter === 'pond' && item.type !== 'pond') return false;
        if (typeFilter === 'test' && item.type !== 'test') return false;
        if (typeFilter === 'agent' && (item.type !== 'test' || item.submitterCategory !== 'agent')) return false;
        if (typeFilter === 'asm' && (item.type !== 'test' || item.submitterCategory !== 'asm')) return false;
      }

      // Submitter Filter (applies to tests)
      if (submitterFilter && item.type === 'test') {
        if (item.submitterName !== submitterFilter) return false;
      } else if (submitterFilter && item.type !== 'test') {
        return false;
      }

      // Status Filter (for tests)
      if (statusFilter && item.type === 'test') {
        if (statusFilter === 'VERIFIED' && !['VERIFIED', 'APPROVED'].includes(item.status)) return false;
        if (statusFilter === 'PENDING' && !['PENDING', 'PENDING_VERIFICATION'].includes(item.status)) return false;
      }

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = item.name?.toLowerCase().includes(q);
        const matchesCity = item.city?.toLowerCase().includes(q);
        const matchesFarmer = item.farmer_name?.toLowerCase().includes(q) || item.farmerName?.toLowerCase().includes(q);
        const matchesMobile = item.mobile?.includes(q) || item.farmerMobile?.includes(q);
        const matchesSubmitter = item.submitterName?.toLowerCase().includes(q);
        const matchesTestType = item.testType?.toLowerCase().includes(q);
        const matchesLocality = item.locality?.toLowerCase().includes(q);
        const matchesId = item.rawId?.toString().toLowerCase().includes(q);

        if (
          !matchesName &&
          !matchesCity &&
          !matchesFarmer &&
          !matchesMobile &&
          !matchesSubmitter &&
          !matchesTestType &&
          !matchesLocality &&
          !matchesId
        ) {
          return false;
        }
      }
      return true;
    });
  }, [items, typeFilter, submitterFilter, statusFilter, search]);

  // Statistics counts
  const farmersCount = useMemo(() => items.filter(i => i.type === 'farmer').length, [items]);
  const pondsCount = useMemo(() => items.filter(i => i.type === 'pond').length, [items]);
  const agentTestsCount = useMemo(() => items.filter(i => i.type === 'test' && i.submitterCategory === 'agent').length, [items]);
  const asmTestsCount = useMemo(() => items.filter(i => i.type === 'test' && i.submitterCategory === 'asm').length, [items]);
  const totalTestsCount = agentTestsCount + asmTestsCount;

  // Init map
  useEffect(() => {
    const L = getL();
    if (!isLeafletReady || !L || !mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [16.5448, 81.5212], // Centered around AP Aquaculture belt
      zoom: 8,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = markersLayer;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      markerMapRef.current.clear();
    };
  }, [isLeafletReady]);

  // Update markers
  useEffect(() => {
    const L = getL();
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!isLeafletReady || !L || !map || !markersLayer) return;

    markersLayer.clearLayers();
    markerMapRef.current.clear();
    const bounds = L.latLngBounds([]);
    let hasBounds = false;

    filtered.forEach(item => {
      let icon;
      let popupContent = '';

      if (item.type === 'farmer') {
        // Farmer Pin (Blue)
        icon = L.divIcon({
          className: 'custom-pin-farmer',
          html: `<div style="
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            width: 30px;
            height: 30px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid #ffffff;
            box-shadow: 0 3px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="transform: rotate(45deg); font-size: 13px;">👨‍🌾</span>
          </div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30],
        });

        popupContent = `
          <div style="font-family: inherit; font-size: 13px; min-width: 210px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 6px; background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe;">
                Farmer
              </span>
            </div>
            <p style="font-weight: 700; font-size: 14px; color: #111827; margin: 0 0 4px 0;">${item.name}</p>
            ${item.contact_person ? `<p style="color: #4b5563; font-size: 12px; margin: 0 0 2px 0;">👤 ${item.contact_person}</p>` : ''}
            ${item.city ? `<p style="color: #6b7280; font-size: 12px; margin: 0 0 4px 0;">📍 ${item.city}${item.state ? `, ${item.state}` : ''}</p>` : ''}
            ${item.mobile ? `<p style="margin: 4px 0; font-size: 12px;"><a href="tel:${item.mobile}" style="color: #2563eb; font-weight: 600; text-decoration: none;">📞 ${item.mobile}</a></p>` : ''}
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #f3f4f6; display: flex; gap: 10px;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}" 
                 target="_blank" rel="noreferrer" 
                 style="font-size: 11px; color: #2563eb; font-weight: 600; text-decoration: none;">
                Directions ↗
              </a>
              <a href="/clients/${item.rawId}" style="font-size: 11px; color: #4b5563; font-weight: 600; text-decoration: none;">
                View Profile
              </a>
            </div>
          </div>
        `;
      } else if (item.type === 'pond') {
        // Pond Pin (Green)
        icon = L.divIcon({
          className: 'custom-pin-pond',
          html: `<div style="
            background: linear-gradient(135deg, #059669, #047857);
            width: 30px;
            height: 30px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid #ffffff;
            box-shadow: 0 3px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="transform: rotate(45deg); font-size: 12px;">💧</span>
          </div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30],
        });

        popupContent = `
          <div style="font-family: inherit; font-size: 13px; min-width: 210px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 6px; background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0;">
                Pond / Tank
              </span>
            </div>
            <p style="font-weight: 700; font-size: 14px; color: #111827; margin: 0 0 4px 0;">${item.name}</p>
            ${item.farmer_name ? `<p style="color: #4b5563; font-size: 12px; margin: 0 0 2px 0;">🌾 Farmer: <strong>${item.farmer_name}</strong></p>` : ''}
            ${item.area_acres ? `<p style="color: #6b7280; font-size: 12px; margin: 0 0 4px 0;">📏 ${item.area_acres} Acres ${item.culture_type ? `· ${item.culture_type}` : ''}</p>` : ''}
            ${item.mobile ? `<p style="margin: 4px 0; font-size: 12px;"><a href="tel:${item.mobile}" style="color: #059669; font-weight: 600; text-decoration: none;">📞 ${item.mobile}</a></p>` : ''}
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #f3f4f6; display: flex; gap: 10px;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}" 
                 target="_blank" rel="noreferrer" 
                 style="font-size: 11px; color: #059669; font-weight: 600; text-decoration: none;">
                Directions ↗
              </a>
              ${item.clientId ? `
                <a href="/clients/${item.clientId}" style="font-size: 11px; color: #4b5563; font-weight: 600; text-decoration: none;">
                  View Farmer
                </a>
              ` : ''}
            </div>
          </div>
        `;
      } else if (item.type === 'test') {
        // Test Submission Marker (Purple for ASM, Amber/Orange for Agent)
        const isAsm = item.submitterCategory === 'asm';
        const isVerified = ['VERIFIED', 'APPROVED'].includes(item.status);
        const pinBg = isAsm
          ? 'linear-gradient(135deg, #7c3aed, #9333ea)'
          : 'linear-gradient(135deg, #ea580c, #f59e0b)';
        const shadowColor = isAsm ? 'rgba(124, 58, 237, 0.45)' : 'rgba(234, 88, 12, 0.45)';
        const badgeLabel = isAsm ? 'ASM Test' : 'Agent Test';
        const roleColor = isAsm ? 'background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe;' : 'background: #fef3c7; color: #92400e; border: 1px solid #fde68a;';

        icon = L.divIcon({
          className: `custom-pin-test-${item.submitterCategory}`,
          html: `<div style="
            background: ${pinBg};
            width: 34px;
            height: 34px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2.5px solid #ffffff;
            box-shadow: 0 4px 10px ${shadowColor};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          ">
            <span style="transform: rotate(45deg); font-size: 14px; line-height: 1;">🧪</span>
          </div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -34],
        });

        // Format test parameters badges
        let paramsHtml = '';
        if (item.parameters && typeof item.parameters === 'object' && Object.keys(item.parameters).length > 0) {
          const badges = Object.entries(item.parameters)
            .filter(([_, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => {
              const formattedKey = k
                .replace(/_/g, ' ')
                .replace(/ppm|ppt|pct|c|grams/gi, '')
                .trim();
              return `<span style="display: inline-block; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 2px 6px; font-size: 11px; margin: 2px 2px 2px 0;">
                <span style="color: #4b5563; text-transform: capitalize;">${formattedKey}:</span> 
                <strong style="color: #1e40af;">${v}</strong>
              </span>`;
            })
            .join('');

          if (badges) {
            paramsHtml = `
              <div style="margin: 6px 0; padding: 6px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                <span style="font-size: 9px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 3px;">
                  Test Parameters:
                </span>
                <div style="display: flex; flex-wrap: wrap;">${badges}</div>
              </div>
            `;
          }
        }

        popupContent = `
          <div style="font-family: inherit; font-size: 13px; min-width: 250px; max-width: 320px; padding: 4px;">
            {/* Header */}
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 4px;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2px 8px; border-radius: 6px; ${roleColor}">
                ${badgeLabel}
              </span>
              <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; ${
                isVerified
                  ? 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;'
                  : 'background: #fffbeb; color: #b45309; border: 1px solid #fde68a;'
              }">
                ${item.status}
              </span>
            </div>

            {/* Test Type & ID */}
            <p style="font-weight: 800; font-size: 14px; color: #111827; margin: 0 0 2px 0;">
              ${item.testType}
            </p>
            <p style="color: #9ca3af; font-size: 10px; margin: 0 0 8px 0; font-family: monospace;">
              ID: ${item.rawId}
            </p>

            {/* Submitter Details */}
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px;">
              <span style="font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; display: block;">
                Submitted By
              </span>
              <p style="font-weight: 700; color: #111827; font-size: 12px; margin: 1px 0 0 0;">
                ${item.submitterName}
              </p>
              <p style="color: #6b7280; font-size: 11px; margin: 0;">
                ${item.submitterRole} ${item.agentId ? `· ID: ${item.agentId}` : ''}
              </p>
            </div>

            {/* Farmer & Tank */}
            <p style="color: #374151; font-size: 12px; margin: 0 0 3px 0;">
              🌾 <strong>${item.farmerName}</strong> · 💧 ${item.tankName}
            </p>

            {/* Submission Location & Accuracy */}
            <p style="color: #4b5563; font-size: 11px; margin: 0 0 3px 0;">
              📍 <strong>Location:</strong> ${item.locality}
            </p>
            <p style="color: #6b7280; font-size: 10px; margin: 0 0 4px 0; font-family: monospace;">
              Coords: ${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)} ${item.accuracy ? `(±${Math.round(item.accuracy)}m)` : ''}
            </p>

            {/* Timestamp */}
            <p style="color: #6b7280; font-size: 11px; margin: 0 0 6px 0;">
              🕒 <strong>Submitted:</strong> ${item.date || ''} ${item.submissionTime || ''}
            </p>

            {/* Test Parameters */}
            ${paramsHtml}

            {/* Notes */}
            ${item.notes ? `
              <div style="background: #fff; border-left: 3px solid ${isAsm ? '#7c3aed' : '#ea580c'}; padding: 4px 8px; font-size: 11px; color: #4b5563; margin: 6px 0; font-style: italic;">
                "${item.notes}"
              </div>
            ` : ''}

            {/* Bottom Actions */}
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}" 
                 target="_blank" rel="noreferrer" 
                 style="font-size: 11px; color: ${isAsm ? '#7c3aed' : '#ea580c'}; font-weight: 700; text-decoration: none;">
                Navigate Here ↗
              </a>
              ${item.farmerId ? `
                <a href="/clients/${item.farmerId}" style="font-size: 11px; color: #2563eb; font-weight: 600; text-decoration: none;">
                  Farmer Profile →
                </a>
              ` : ''}
            </div>
          </div>
        `;
      }

      const marker = L.marker([item.latitude, item.longitude], {
        icon,
        title: `${item.name || item.testType} (${item.type})`,
      });
      marker.bindPopup(popupContent, { maxWidth: 350 });
      marker.addTo(markersLayer);
      markerMapRef.current.set(item.id, marker);

      bounds.extend([item.latitude, item.longitude]);
      hasBounds = true;
    });

    if (hasBounds) {
      // If newly submitted item exists, zoom and open it
      if (newlySubmittedId && markerMapRef.current.has(`test-${newlySubmittedId}`)) {
        const newMarker = markerMapRef.current.get(`test-${newlySubmittedId}`);
        map.setView(newMarker.getLatLng(), 15);
        newMarker.openPopup();
        setNewlySubmittedId(null);
      } else {
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 13 });
      }
    }
  }, [filtered, isLeafletReady, newlySubmittedId]);

  // Handle successful test submission from modal
  const handleTestSubmitSuccess = (newItem) => {
    queryClient.invalidateQueries(['map-locations']);
    refetch();
    if (newItem?.id) {
      setNewlySubmittedId(newItem.id);
    }
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Maps & Field Locations</h1>
            {isFetching && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                <ArrowPathIcon className="w-3 h-3 animate-spin" />
                Syncing
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time map showing farmers, ponds, and test submission locations captured by Agents & ASMs.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary text-xs flex items-center gap-1.5"
            title="Refresh submissions from server"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="btn-primary text-xs flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
          >
            <PlusIcon className="w-4 h-4 stroke-[2.5]" />
            Submit Test & Pin
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div 
          onClick={() => setTypeFilter(typeFilter === 'farmer' ? '' : 'farmer')}
          className={`p-3 rounded-xl border cursor-pointer transition ${
            typeFilter === 'farmer' ? 'bg-blue-50 border-blue-400 shadow-xs' : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Farmers Mapped</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-1">{farmersCount}</p>
        </div>

        <div 
          onClick={() => setTypeFilter(typeFilter === 'pond' ? '' : 'pond')}
          className={`p-3 rounded-xl border cursor-pointer transition ${
            typeFilter === 'pond' ? 'bg-emerald-50 border-emerald-400 shadow-xs' : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Ponds Mapped</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-1">{pondsCount}</p>
        </div>

        <div 
          onClick={() => setTypeFilter(typeFilter === 'agent' ? '' : 'agent')}
          className={`p-3 rounded-xl border cursor-pointer transition ${
            typeFilter === 'agent' ? 'bg-amber-50 border-amber-400 shadow-xs' : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">Agent Tests</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-1">{agentTestsCount}</p>
        </div>

        <div 
          onClick={() => setTypeFilter(typeFilter === 'asm' ? '' : 'asm')}
          className={`p-3 rounded-xl border cursor-pointer transition ${
            typeFilter === 'asm' ? 'bg-purple-50 border-purple-400 shadow-xs' : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700">ASM Tests</span>
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-1">{asmTestsCount}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchValue={search}
        onSearch={setSearch}
        onReset={() => {
          setSearch('');
          setTypeFilter('');
          setSubmitterFilter('');
          setStatusFilter('');
        }}
      >
        <SelectFilter
          label="All Categories"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'test', label: 'All Test Submissions (Agent & ASM)' },
            { value: 'agent', label: 'Agent Tests only' },
            { value: 'asm', label: 'ASM Tests only' },
            { value: 'farmer', label: 'Farmers only' },
            { value: 'pond', label: 'Ponds only' },
          ]}
        />

        {/* Submitter Filter */}
        {uniqueSubmitters.length > 0 && (
          <SelectFilter
            label="All Submitters"
            value={submitterFilter}
            onChange={setSubmitterFilter}
            options={uniqueSubmitters.map(s => ({
              value: s.name,
              label: `${s.name} (${s.category === 'asm' ? 'ASM' : 'Agent'})`,
            }))}
          />
        )}

        {/* Status Filter */}
        <SelectFilter
          label="All Statuses"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'VERIFIED', label: 'Verified only' },
            { value: 'PENDING', label: 'Pending Verification' },
          ]}
        />
      </FilterBar>

      {/* Map Container Card */}
      <div className="card overflow-hidden relative shadow-sm">
        <div ref={mapContainerRef} className="w-full h-[620px] z-0" />

        {/* Floating Legend */}
        <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-xs rounded-xl shadow-lg border border-gray-200/90 p-3 text-xs pointer-events-auto">
          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-2 tracking-wider">
            Map Legend ({filtered.length} visible)
          </span>
          <div className="flex flex-col gap-1.5">
            <div 
              onClick={() => setTypeFilter(typeFilter === 'farmer' ? '' : 'farmer')}
              className={`flex items-center gap-2 cursor-pointer hover:opacity-80 transition ${typeFilter === 'farmer' ? 'font-bold text-blue-700' : 'text-gray-700'}`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-white shadow-xs flex-shrink-0" />
              <span>Farmers ({farmersCount})</span>
            </div>

            <div 
              onClick={() => setTypeFilter(typeFilter === 'pond' ? '' : 'pond')}
              className={`flex items-center gap-2 cursor-pointer hover:opacity-80 transition ${typeFilter === 'pond' ? 'font-bold text-emerald-700' : 'text-gray-700'}`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 border border-white shadow-xs flex-shrink-0" />
              <span>Ponds ({pondsCount})</span>
            </div>

            <div 
              onClick={() => setTypeFilter(typeFilter === 'agent' ? '' : 'agent')}
              className={`flex items-center gap-2 cursor-pointer hover:opacity-80 transition ${typeFilter === 'agent' ? 'font-bold text-amber-700' : 'text-gray-700'}`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white shadow-xs flex-shrink-0" />
              <span>Agent Test Locations ({agentTestsCount})</span>
            </div>

            <div 
              onClick={() => setTypeFilter(typeFilter === 'asm' ? '' : 'asm')}
              className={`flex items-center gap-2 cursor-pointer hover:opacity-80 transition ${typeFilter === 'asm' ? 'font-bold text-purple-700' : 'text-gray-700'}`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-purple-600 border border-white shadow-xs flex-shrink-0" />
              <span>ASM Test Locations ({asmTestsCount})</span>
            </div>
          </div>
        </div>

        {/* Live Indicator Pill */}
        <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-xs rounded-full shadow-md border border-gray-200 px-3 py-1 flex items-center gap-2 text-xs font-semibold text-gray-700">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span>Live GPS Sync Active</span>
        </div>
      </div>

      {/* Submit Test Modal */}
      <SubmitTestModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onSuccess={handleTestSubmitSuccess}
      />
    </div>
  );
}
