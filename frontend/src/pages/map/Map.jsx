import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import clientService from '../../services/clientService';
import { PageSpinner } from '../../components/common/Spinner';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';

const getL = () => (typeof window !== 'undefined' ? window.L : null);

export default function MapPage() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isLeafletReady, setIsLeafletReady] = useState(Boolean(typeof window !== 'undefined' && window.L));

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

  const { data, isLoading } = useQuery({
    queryKey: ['map-locations'],
    queryFn: () => clientService.getMapLocations().then(res => res.data.data),
  });

  const clients = data?.clients || [];
  const ponds = data?.ponds || [];

  // Mappable items with valid coordinates
  const items = useMemo(() => {
    const list = [];

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

    return list;
  }, [clients, ponds]);

  // Filtered items
  const filtered = useMemo(() => {
    return items.filter(item => {
      if (typeFilter && item.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = item.name?.toLowerCase().includes(q);
        const matchesCity = item.city?.toLowerCase().includes(q);
        const matchesFarmer = item.farmer_name?.toLowerCase().includes(q);
        const matchesMobile = item.mobile?.includes(q);
        if (!matchesName && !matchesCity && !matchesFarmer && !matchesMobile) return false;
      }
      return true;
    });
  }, [items, typeFilter, search]);

  // Init map
  useEffect(() => {
    const L = getL();
    if (!isLeafletReady || !L || !mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
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
    };
  }, [isLeafletReady]);

  // Update markers
  useEffect(() => {
    const L = getL();
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!isLeafletReady || !L || !map || !markersLayer) return;

    markersLayer.clearLayers();
    const bounds = L.latLngBounds([]);
    let hasBounds = false;

    filtered.forEach(item => {
      const isFarmer = item.type === 'farmer';
      const color = isFarmer ? '#2563eb' : '#059669';

      const icon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="
          background-color: ${color};
          width: 28px;
          height: 28px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="transform: rotate(45deg); width: 8px; height: 8px; background: #fff; border-radius: 50%;"></div>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      });

      const popup = `
        <div style="font-family: inherit; font-size: 13px; min-width: 190px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; ${
              isFarmer ? 'background: #dbeafe; color: #1e40af;' : 'background: #d1fae5; color: #065f46;'
            }">
              ${isFarmer ? 'Farmer' : 'Pond'}
            </span>
          </div>

          <p style="font-weight: 600; color: #111827; margin: 4px 0 2px 0;">${item.name}</p>

          ${!isFarmer && item.farmer_name ? `<p style="color: #6b7280; font-size: 12px; margin: 0 0 2px 0;">Farmer: ${item.farmer_name}</p>` : ''}
          ${!isFarmer && item.area_acres ? `<p style="color: #6b7280; font-size: 12px; margin: 0 0 2px 0;">${item.area_acres} Acres ${item.culture_type ? `· ${item.culture_type}` : ''}</p>` : ''}
          ${item.city ? `<p style="color: #6b7280; font-size: 12px; margin: 0 0 4px 0;">${item.city}${item.state ? `, ${item.state}` : ''}</p>` : ''}

          ${item.mobile ? `<p style="margin: 4px 0; font-size: 12px;"><a href="tel:${item.mobile}" style="color: #2563eb; text-decoration: none;">📞 ${item.mobile}</a></p>` : ''}

          <div style="margin-top: 8px; pt: 6px; border-top: 1px solid #f3f4f6; display: flex; gap: 8px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}" 
               target="_blank" rel="noreferrer" 
               style="font-size: 11px; color: #2563eb; text-decoration: none;">
              Directions ↗
            </a>
            ${isFarmer ? `
              <a href="/clients/${item.rawId}" style="font-size: 11px; color: #4b5563; text-decoration: none;">
                View Profile
              </a>
            ` : item.clientId ? `
              <a href="/clients/${item.clientId}" style="font-size: 11px; color: #4b5563; text-decoration: none;">
                View Farmer
              </a>
            ` : ''}
          </div>
        </div>
      `;

      const marker = L.marker([item.latitude, item.longitude], { icon, title: item.name });
      marker.bindPopup(popup);
      marker.addTo(markersLayer);

      bounds.extend([item.latitude, item.longitude]);
      hasBounds = true;
    });

    if (hasBounds) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }
  }, [filtered, isLeafletReady]);

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Map</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} locations mapped ({items.filter(i => i.type === 'farmer').length} farmers, {items.filter(i => i.type === 'pond').length} ponds)
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchValue={search}
        onSearch={setSearch}
        onReset={() => { setSearch(''); setTypeFilter(''); }}
      >
        <SelectFilter
          label="All Types"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'farmer', label: 'Farmers only' },
            { value: 'pond', label: 'Ponds only' },
          ]}
        />
      </FilterBar>

      {/* Minimal Map Card */}
      <div className="card overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-[620px] z-0" />
      </div>
    </div>
  );
}
