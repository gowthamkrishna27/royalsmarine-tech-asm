import { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function FilterBar({ filters, onFilterChange, onSearch, searchValue, children, onReset }) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 mb-4">
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
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 flex-1 sm:flex-initial">
        {children}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="btn-secondary shrink-0 h-[38px] flex items-center justify-center gap-1.5 px-3 text-xs sm:text-sm active:scale-95 transition"
            title="Reset Filters"
          >
            <FunnelIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function SelectFilter({ label, value, onChange, options = [], className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : label;

  return (
    <div ref={dropdownRef} className={`relative flex-1 sm:flex-initial min-w-[130px] sm:min-w-[140px] ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`input w-full flex items-center justify-between gap-1.5 text-left cursor-pointer transition select-none ${
          value ? 'text-gray-900 font-medium bg-blue-50/40 border-blue-200' : 'text-gray-600'
        } ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-500' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate text-xs sm:text-sm">{displayLabel}</span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 max-h-60 overflow-y-auto divide-y divide-gray-50"
        >
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center justify-between transition-colors ${
              !value
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            <span className="truncate">{label}</span>
            {!value && <CheckIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0 ml-1.5" />}
          </button>
          {options.map((opt) => {
            const isSelected = String(value) === String(opt.value);
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <CheckIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0 ml-1.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
