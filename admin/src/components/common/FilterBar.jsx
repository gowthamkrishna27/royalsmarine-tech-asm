import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';

export default function FilterBar({ filters, onFilterChange, onSearch, searchValue, children, onReset }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      {onSearch !== undefined && (
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      )}
      {children}
      {onReset && (
        <button onClick={onReset} className="btn-secondary flex-shrink-0">
          <FunnelIcon className="w-4 h-4" /> Reset
        </button>
      )}
    </div>
  );
}

export function SelectFilter({ label, value, onChange, options, className = '' }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`input flex-shrink-0 ${className}`}>
      <option value="">{label}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
