import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Modal from './Modal';
import Spinner from './Spinner';
import { MapPinIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { MapPinIcon as MapPinSolidIcon } from '@heroicons/react/24/solid';

const getLeaflet = () => (typeof L !== 'undefined' ? L : (typeof window !== 'undefined' ? window.L : null));

const parseCoordinates = (text) => {
  if (!text) return null;
  const cleaned = text.trim();
  const match = cleaned.match(/^([+-]?\d+(?:\.\d+)?)[,\s]+([+-]?\d+(?:\.\d+)?)$/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
};

export default function TankMapPickerModal({
  open,
  onClose,
  tankName = 'Farm',
  initialCoords = null,
  defaultCenter = null,
  onConfirm,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const searchContainerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Sync coords when opening
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSearchResults([]);
      setShowDropdown(false);

      if (initialCoords?.latitude && initialCoords?.longitude) {
        setCoords({
          latitude: parseFloat(initialCoords.latitude),
          longitude: parseFloat(initialCoords.longitude),
        });
      } else if (defaultCenter?.latitude && defaultCenter?.longitude) {
        setCoords({
          latitude: parseFloat(defaultCenter.latitude),
          longitude: parseFloat(defaultCenter.longitude),
        });
      } else {
        setCoords({ latitude: 16.5062, longitude: 80.6480 });
      }
    }
  }, [open, initialCoords, defaultCenter]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time Geocoding Search (Photon API + Nominatim fallback + Direct GPS coordinates)
  const executeSearch = async (queryText) => {
    const q = (queryText || searchQuery).trim();
    if (!q) return [];

    // Direct coordinates detection
    const directCoords = parseCoordinates(q);
    if (directCoords) {
      const coordItem = {
        title: `GPS: ${directCoords.latitude.toFixed(5)}, ${directCoords.longitude.toFixed(5)}`,
        subtitle: 'Direct Coordinate Jump',
        lat: directCoords.latitude,
        lon: directCoords.longitude,
      };
      setSearchResults([coordItem]);
      setShowDropdown(true);
      return [coordItem];
    }

    if (q.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return [];
    }

    setIsSearching(true);
    try {
      // 1. Try Photon (Fast, typo-tolerant, no CORS issue, biased to current center)
      const currentCenter = coords || { latitude: 16.5, longitude: 80.6 };
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        q
      )}&limit=6&lat=${currentCenter.latitude}&lon=${currentCenter.longitude}`;

      const res = await fetch(photonUrl);
      if (res.ok) {
        const data = await res.json();
        if (data?.features && data.features.length > 0) {
          const items = data.features.map((f) => {
            const parts = [
              f.properties.name,
              f.properties.district || f.properties.county || f.properties.city,
              f.properties.state,
              f.properties.country,
            ].filter(Boolean);
            const uniqueParts = parts.filter((p, i) => parts.indexOf(p) === i);
            return {
              title: f.properties.name || uniqueParts[0] || 'Location',
              subtitle: uniqueParts.slice(1).join(', ') || f.properties.country || '',
              lat: f.geometry.coordinates[1],
              lon: f.geometry.coordinates[0],
            };
          });
          setSearchResults(items);
          setShowDropdown(true);
          return items;
        }
      }

      // 2. Fallback to OpenStreetMap Nominatim
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q
      )}&limit=6&addressdetails=1`;
      const nomRes = await fetch(nomUrl);
      if (nomRes.ok) {
        const nomData = await nomRes.json();
        if (Array.isArray(nomData) && nomData.length > 0) {
          const items = nomData.map((item) => {
            const parts = (item.display_name || '').split(',').map((s) => s.trim());
            return {
              title: parts[0] || item.display_name,
              subtitle: parts.slice(1, 4).join(', '),
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
            };
          });
          setSearchResults(items);
          setShowDropdown(true);
          return items;
        }
      }

      setSearchResults([]);
      setShowDropdown(false);
      return [];
    } catch (err) {
      console.warn('Map geocoding search failed:', err);
      setSearchResults([]);
      setShowDropdown(false);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const direct = parseCoordinates(val);
    if (direct) {
      const coordItem = {
        title: `GPS: ${direct.latitude.toFixed(5)}, ${direct.longitude.toFixed(5)}`,
        subtitle: 'Click to jump to coordinates',
        lat: direct.latitude,
        lon: direct.longitude,
      };
      setSearchResults([coordItem]);
      setShowDropdown(true);
      return;
    }

    if (!val.trim() || val.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(val);
    }, 300);
  };

  const handleSelectLocation = (item) => {
    const lat = typeof item.lat === 'number' ? item.lat : parseFloat(item.lat);
    const lon = typeof item.lon === 'number' ? item.lon : parseFloat(item.lon);
    if (!isNaN(lat) && !isNaN(lon)) {
      setCoords({ latitude: lat, longitude: lon });
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([lat, lon], 16, { duration: 1.2 });
      }
      setShowDropdown(false);
      setSearchQuery(item.title);
    }
  };

  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    // Direct coords check
    const direct = parseCoordinates(q);
    if (direct) {
      handleSelectLocation({
        title: `${direct.latitude.toFixed(5)}, ${direct.longitude.toFixed(5)}`,
        lat: direct.latitude,
        lon: direct.longitude,
      });
      return;
    }

    if (searchResults.length > 0) {
      handleSelectLocation(searchResults[0]);
    } else {
      const items = await executeSearch(q);
      if (items && items.length > 0) {
        handleSelectLocation(items[0]);
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  // Initialize Leaflet Map inside Modal
  useEffect(() => {
    if (!open) return;

    const leafletObj = getLeaflet();
    if (!leafletObj || !mapContainerRef.current) return;

    // Determine initial center
    const hasInitial = initialCoords?.latitude && initialCoords?.longitude;
    const hasDefault = defaultCenter?.latitude && defaultCenter?.longitude;

    const centerLat = hasInitial
      ? parseFloat(initialCoords.latitude)
      : hasDefault
      ? parseFloat(defaultCenter.latitude)
      : 16.5062; // Krishna-Godavari aquaculture region default

    const centerLng = hasInitial
      ? parseFloat(initialCoords.longitude)
      : hasDefault
      ? parseFloat(defaultCenter.longitude)
      : 80.6480;

    const zoom = hasInitial || hasDefault ? 16 : 10;

    // Clean up previous instance if any
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        // ignore
      }
      mapInstanceRef.current = null;
    }

    const map = leafletObj.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom,
      zoomControl: true,
    });

    // Ultra-High Resolution Google Hybrid Satellite (DEFAULT with 2x Retina scale)
    const googleHybrid = leafletObj.tileLayer(
      'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=2',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        keepBuffer: 8,
        attribution: '&copy; Google Maps HD',
      }
    );

    // Pure Crystal-Clear Satellite (No text clutter, perfect for spotting shrimp ponds)
    const googlePureSat = leafletObj.tileLayer(
      'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&scale=2',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        keepBuffer: 8,
        attribution: '&copy; Google Satellite HD',
      }
    );

    // Esri World Imagery (High-Clarity Satellite for Agriculture & Farms)
    const esriSat = leafletObj.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        keepBuffer: 8,
        attribution: '&copy; Esri World Imagery',
      }
    );

    // Google Streets HD
    const roadmapLayer = leafletObj.tileLayer(
      'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        keepBuffer: 8,
        attribution: '&copy; Google Maps',
      }
    );

    // Add Google Hybrid HD as DEFAULT
    googleHybrid.addTo(map);

    const baseMaps = {
      '🛰️ Google Hybrid HD': googleHybrid,
      '🌍 Pure Satellite HD': googlePureSat,
      '🌾 Esri Clarity HD': esriSat,
      '🏙️ Google Streets HD': roadmapLayer,
    };

    leafletObj.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

    // Set initial coordinates to center immediately
    setCoords({ latitude: centerLat, longitude: centerLng });

    // Sync coords continuously whenever the map is panned or moved
    const syncCenterCoords = () => {
      const center = map.getCenter();
      setCoords({ latitude: center.lat, longitude: center.lng });
    };

    map.on('move', syncCenterCoords);
    map.on('moveend', syncCenterCoords);
    map.on('zoomend', syncCenterCoords);

    // Clicking anywhere on map smoothly centers the middle pin on that point
    map.on('click', (e) => {
      map.panTo(e.latlng);
    });

    mapInstanceRef.current = map;

    // Staggered size invalidation for smooth modal expansion
    const t1 = setTimeout(() => map.invalidateSize(), 60);
    const t2 = setTimeout(() => map.invalidateSize(), 200);
    const t3 = setTimeout(() => map.invalidateSize(), 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      try {
        map.remove();
      } catch (e) {
        // ignore
      }
      mapInstanceRef.current = null;
    };
  }, [open]);

  const currentLocationMarkerRef = useRef(null);

  // User location trigger
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        const map = mapInstanceRef.current;
        const leafletObj = getLeaflet();
        if (!map) return;

        setCoords({ latitude, longitude });
        map.flyTo([latitude, longitude], 17, { duration: 1 });

        if (leafletObj) {
          if (currentLocationMarkerRef.current) {
            currentLocationMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            const locIcon = leafletObj.icon({
              iconUrl: '/logo.png',
              iconSize: [28, 28],
              iconAnchor: [14, 14],
              className: 'current-loc-logo',
            });
            const marker = leafletObj.marker([latitude, longitude], {
              icon: locIcon,
              zIndexOffset: 300,
              title: 'My GPS Location',
            });
            marker.addTo(map);
            currentLocationMarkerRef.current = marker;
          }
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSave = () => {
    if (coords && onConfirm) {
      onConfirm(coords);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${tankName} Location`}
      size="md"
    >
      <div className="space-y-3">
        {/* Real-time search bar & My Location toolbar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          {/* Search Box with Real-time Dropdown */}
          <div ref={searchContainerRef} className="relative flex-1">
            <div className="relative flex items-center">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search village, mandal, town, or paste GPS..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
              {isSearching ? (
                <div className="absolute right-2.5">
                  <Spinner size="xs" />
                </div>
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2 text-gray-400 hover:text-gray-600 p-0.5 rounded"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {/* Suggestions Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-[1000] max-h-48 overflow-y-auto divide-y divide-gray-100">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectLocation(item)}
                    className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-start gap-2 transition"
                  >
                    <MapPinIcon className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="truncate flex-1">
                      <span className="font-medium text-gray-900 block truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-[11px] text-gray-500 block truncate">{item.subtitle}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Explicit Search Button */}
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="btn-secondary btn-sm py-1.5 px-3 text-xs font-medium shrink-0 disabled:opacity-50"
          >
            Search
          </button>

          {/* My Location button */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="btn-secondary btn-sm py-1.5 px-2.5 text-xs flex items-center gap-1 font-medium shadow-xs shrink-0"
            title="Locate my position"
          >
            {locating ? <Spinner size="xs" /> : <MapPinIcon className="w-3.5 h-3.5 text-gray-500" />}
            <span className="hidden sm:inline">My Location</span>
          </button>
        </form>

        {/* Small Map canvas with fixed middle pin */}
        <div
          className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-900 shadow-inner"
          style={{ height: '280px', width: '100%', minHeight: '280px' }}
        >
          <div
            ref={mapContainerRef}
            style={{ height: '100%', width: '100%', minHeight: '280px' }}
            className="z-0"
          />

          {/* Simple Middle Pin */}
          <div
            className="pointer-events-none absolute z-[500] flex flex-col items-center"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -100%)',
            }}
          >
            <MapPinSolidIcon className="w-8 h-8 text-red-600 drop-shadow-md" />
            <div className="w-2 h-0.5 bg-black/40 rounded-full blur-[0.5px] -mt-1" />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-gray-700 font-mono font-semibold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
            {coords ? (
              `${Number(coords.latitude).toFixed(5)}, ${Number(coords.longitude).toFixed(5)}`
            ) : (
              <span className="text-gray-400 font-sans font-normal">Locating center...</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary btn-sm px-4 py-1.5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!coords}
              className="btn-primary btn-sm px-4 py-1.5 shadow-xs"
            >
              Save Pin
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
