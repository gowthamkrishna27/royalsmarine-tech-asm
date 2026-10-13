import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { opportunityApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import EmptyState from '../../components/common/EmptyState';
import { ChartBarIcon, PlusIcon } from '@heroicons/react/24/outline';
import { OPPORTUNITY_STAGES } from '../../constants';

export default function Opportunities() {
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['opportunities', page, stage, search],
    queryFn: () => opportunityApi.list({ page, limit: 20, stage, search }).then(r => r.data),
  });

  const { data: pipeline } = useQuery({
    queryKey: ['pipeline'],
    queryFn: () => opportunityApi.pipeline().then(r => r.data.data),
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Opportunities</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total || 0} opportunities</p>
        </div>
        <Link to="/opportunities/new" className="btn-primary btn-sm">
          <PlusIcon className="w-4 h-4" /> Add Opportunity
        </Link>
      </div>

      {/* Pipeline summary */}
      {pipeline?.pipeline && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {OPPORTUNITY_STAGES.filter(s => s.value !== 'lost').map(s => {
            const p = pipeline.pipeline.find(pp => pp.current_stage === s.value);
            return (
              <button key={s.value} onClick={() => setStage(s.value === stage ? '' : s.value)}
                className={`card p-3 text-center cursor-pointer hover:shadow-md transition ${stage === s.value ? 'ring-2 ring-blue-500' : ''}`}>
                <p className="text-lg font-bold text-gray-900">{p?.count || 0}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">{s.label}</p>
                {p?.total_value > 0 && <p className="text-xs font-medium text-blue-600 mt-1">₹{Number(p.total_value/100000).toFixed(1)}L</p>}
              </button>
            );
          })}
        </div>
      )}

      <FilterBar onSearch={setSearch} searchValue={search} onReset={() => { setStage(''); setSearch(''); }}>
        <SelectFilter label="All Stages" value={stage} onChange={setStage} options={OPPORTUNITY_STAGES} />
      </FilterBar>

      {isLoading ? <PageSpinner /> : (
        <div className="card">
          {data?.data?.length === 0 ? (
            <EmptyState title="No opportunities" icon={ChartBarIcon}
              action={<Link to="/opportunities/new" className="btn-primary btn-sm">Add Opportunity</Link>} />
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {data.data.map(o => (
                  <div key={o.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Link to={`/opportunities/${o.id}`} className="text-sm font-semibold text-gray-900 hover:text-blue-600">{o.title}</Link>
                        <Badge color={OPPORTUNITY_STAGES.find(s => s.value === o.current_stage)?.color || 'gray'}>
                          {OPPORTUNITY_STAGES.find(s => s.value === o.current_stage)?.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{o.company_name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        {o.brand_name && <span>{o.brand_name}</span>}
                        <span>Close: {o.expected_closing_date || 'TBD'}</span>
                        <span>{o.salesperson_name}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {o.estimated_value && (
                        <p className="text-sm font-bold text-gray-900">₹{Number(o.estimated_value).toLocaleString('en-IN')}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{o.probability}% probability</p>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination meta={data.pagination} onPageChange={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
