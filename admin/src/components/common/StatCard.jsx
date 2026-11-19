import { Link } from 'react-router-dom';

const bgColors = {
  'light-blue': 'bg-sky-50/70 border-sky-200/70 hover:border-sky-300',
  'mint-green': 'bg-emerald-50/60 border-emerald-200/70 hover:border-emerald-300',
  'soft-orange': 'bg-orange-50/60 border-orange-200/70 hover:border-orange-300',
};

const iconTextColors = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  red: 'text-red-600',
  yellow: 'text-yellow-600',
  purple: 'text-purple-600',
  orange: 'text-orange-600',
  indigo: 'text-indigo-600',
  amber: 'text-amber-600',
  emerald: 'text-emerald-600',
  cyan: 'text-cyan-600',
  gray: 'text-gray-600',
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  color = 'blue',
  trend,
  sub,
  to,
  onClick,
  className = '',
  bg = '',
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    gray: 'bg-gray-100 text-gray-600',
  };

  const activeBg = bgColors[bg] || bg;

  const card = (
    <div
      onClick={onClick}
      className={`stat-card ${activeBg} ${className} ${to || onClick ? 'hover:shadow-md transition-all cursor-pointer' : ''}`}
    >
      {Icon && (
        <div
          className={`stat-icon ${
            activeBg
              ? `bg-white/90 shadow-xs border border-white/60 ${iconTextColors[color] || 'text-blue-600'}`
              : colors[color] || colors.blue
          }`}
        >
          <Icon className="w-6 h-6" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="stat-label truncate" title={label}>{label}</p>
        <p className="stat-value">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        {trend !== undefined && (
          <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last month
          </p>
        )}
      </div>
    </div>
  );

  return to ? <Link to={to} className="block no-underline">{card}</Link> : card;
}
