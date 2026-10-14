import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';

export default function FilterBar({ filters, onFilterChange, onSearch, searchValue, children, onReset }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-3 mb-4">
      {onSearch !== undefined && (
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            className="input pl-9 h-10 w-full"
          />
        </div>
      )}
      {children}
      {onReset && (
        <button onClick={onReset} className="btn-secondary h-10 flex-shrink-0">
          <FunnelIcon className="w-4 h-4" /> Reset
        </button>
      )}
    </div>
  );
}

export function SelectFilter({ label, value, onChange, options, className = '' }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`input h-10 flex-shrink-0 sm:w-44 ${className}`}>
      <option value="">{label}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

export function DateFilter({ label, value, onChange, className = '', max, min }) {
  return (
    <div className={`flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 h-10 flex-shrink-0 text-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition sm:w-44 ${className}`}>
      {label && (
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap select-none">
          {label}
        </span>
      )}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        max={max}
        min={min}
        className="bg-transparent border-0 outline-none text-sm text-gray-800 cursor-pointer w-full p-0"
      />
    </div>
  );
}
