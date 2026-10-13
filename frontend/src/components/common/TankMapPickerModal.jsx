import { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import Spinner from './Spinner';
import { MapPinIcon, CheckIcon } from '@heroicons/react/24/outline';

const getL = () => (typeof window !== 'undefined' ? window.L : null);

export default function TankMapPickerModal({
  open,
  onClose,
  tankName = 'Tank',
  initialCoords = null,
  defaultCenter = null,
  onConfirm,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);

  // Sync coords when opening
  useEffect(() => {
    if (open) {
      if (initialCoords?.latitude && initialCoords?.longitude) {
        setCoords({
          latitude: parseFloat(initialCoords.latitude),
          longitude: parseFloat(initialCoords.longitude),
        });
      } else {
        setCoords(null);
      }
    }
  }, [open, initialCoords]);

  // Initialize Leaflet Map inside Modal
  useEffect(() => {
    if (!open) return;

    const L = getL();
    if (!L || !mapContainerRef.current) return;

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

    const zoom = hasInitial || hasDefault ? 16 : 8;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: 'tank-picker-marker',
      html: `
        <div style="
          background-color: #2563eb;
          width: 24px;
          height: 24px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          cursor: grab;
        "></div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });

    let currentMarker = null;

    if (hasInitial) {
      currentMarker = L.marker([parseFloat(initialCoords.latitude), parseFloat(initialCoords.longitude)], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      currentMarker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        setCoords({ latitude: pos.lat, longitude: pos.lng });
      });
    }

    // Click on map to place or move marker
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setCoords({ latitude: lat, longitude: lng });

      if (currentMarker) {
        currentMarker.setLatLng([lat, lng]);
      } else {
        currentMarker = L.marker([lat, lng], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        currentMarker.on('dragend', (ev) => {
          const pos = ev.target.getLatLng();
          setCoords({ latitude: pos.lat, longitude: pos.lng });
        });
      }
    });

    mapInstanceRef.current = map;
    markerRef.current = currentMarker;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [open]);

  // User location trigger
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        const map = mapInstanceRef.current;
        const L = getL();
        if (!map || !L) return;

        setCoords({ latitude, longitude });

        const pinIcon = L.divIcon({
          className: 'tank-picker-marker',
          html: `
            <div style="
              background-color: #2563eb;
              width: 24px;
              height: 24px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 2px solid #ffffff;
              box-shadow: 0 2px 6px rgba(0,0,0,0.25);
              cursor: grab;
            "></div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        });

        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        } else {
          markerRef.current = L.marker([latitude, longitude], {
            icon: pinIcon,
            draggable: true,
          }).addTo(map);

          markerRef.current.on('dragend', (ev) => {
            const p = ev.target.getLatLng();
            setCoords({ latitude: p.lat, longitude: p.lng });
          });
        }

        map.flyTo([latitude, longitude], 17, { duration: 1 });
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
      size="lg"
    >
      <div className="space-y-3">
        {/* Minimal toolbar */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Click on map to pin coordinates</span>
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="btn-secondary btn-sm py-1 px-2.5 text-xs flex items-center gap-1"
          >
            {locating ? <Spinner size="xs" /> : <MapPinIcon className="w-3.5 h-3.5 text-gray-500" />}
            <span>My Location</span>
          </button>
        </div>

        {/* Map canvas */}
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <div ref={mapContainerRef} className="w-full h-80 z-0" />
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-gray-500 font-mono">
            {coords ? (
              `${Number(coords.latitude).toFixed(5)}, ${Number(coords.longitude).toFixed(5)}`
            ) : (
              <span className="text-gray-400 font-sans">No pin placed</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!coords}
              className="btn-primary btn-sm"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
