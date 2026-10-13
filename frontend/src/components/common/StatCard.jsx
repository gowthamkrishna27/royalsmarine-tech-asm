import { Link } from 'react-router-dom';

export default function StatCard({ label, value, icon: Icon, color = 'blue', trend, sub, to, onClick }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <p className="text-xs sm:text-sm font-medium text-gray-500 leading-snug group-hover:text-blue-600 transition-colors">{label}</p>
        {Icon && (
          <div className={`p-2 sm:p-2.5 rounded-xl flex-shrink-0 transition-transform group-hover:scale-105 ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="mt-3 sm:mt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold text-gray-900 tracking-tight group-hover:text-blue-700 transition-colors">{value ?? '—'}</p>
          {to && (
            <span className="text-xs font-semibold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
              View →
            </span>
          )}
        </div>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        {trend !== undefined && (
          <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last month
          </p>
        )}
      </div>
    </>
  );

  const baseClassName = "card p-4 sm:p-5 h-full flex flex-col justify-between transition-all duration-150 hover:shadow-md hover:border-blue-300 group";

  if (to) {
    return (
      <Link to={to} className={`${baseClassName} cursor-pointer block no-underline`}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div onClick={onClick} className={`${baseClassName} cursor-pointer`}>
        {content}
      </div>
    );
  }

  return (
    <div className={baseClassName}>
      {content}
    </div>
  );
}
