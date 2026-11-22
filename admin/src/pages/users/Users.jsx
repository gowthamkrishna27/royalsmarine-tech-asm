import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs/dist/exceljs.min.js';
import { userApi } from '../../services/api';
import { downloadBlob } from '../../hooks/useApi';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import {
  UserGroupIcon as UsersIcon,
  PlusIcon as Plus,
  PencilSquareIcon as Pencil,
  MapPinIcon as MapPin,
  CheckIcon as Check,
  PhoneIcon as Phone,
  EnvelopeIcon as Mail,
  MagnifyingGlassIcon as Search,
  XMarkIcon as X,
  ClockIcon as Clock,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export function UserModal({ open, onClose, user, roles, asms, technicalExecutives, onSaved }) {
  const isEdit = Boolean(user?.id);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [selectedExecIds, setSelectedExecIds] = useState([]);
  const [execSearch, setExecSearch] = useState('');

  const selectedRoleId = watch('role_id');
  const selectedRole = useMemo(() => {
    return roles?.find(r => String(r.id) === String(selectedRoleId));
  }, [roles, selectedRoleId]);

  const isAsm = selectedRole?.name === 'sales_manager';
  const isTechExec = selectedRole?.name === 'sales_executive';

  useEffect(() => {
    if (open) {
      if (user) {
        const joiningDateStr = user.joining_date ? user.joining_date.substring(0, 10) : '';
        const roleId = user.role_id || roles?.find(r => r.name === user.role)?.id || '';
        reset({
          full_name: user.full_name || '',
          email: user.email || '',
          mobile: user.mobile || '',
          role_id: roleId,
          manager_id: user.manager_id || '',
          department: user.department || '',
          region: user.region || '',
          area: user.area || '',
          status: user.status || 'active',
          joining_date: joiningDateStr,
        });

        // Pre-fill assigned executives for ASM
        if (user.id) {
          userApi.get(user.id)
            .then(res => {
              const execIds = res.data?.data?.executive_ids || [];
              setSelectedExecIds(execIds);
            })
            .catch(() => {
              setSelectedExecIds([]);
            });
        }
      } else {
        reset({
          full_name: '',
          email: '',
          mobile: '',
          role_id: '',
          manager_id: '',
          department: '',
          region: '',
          area: '',
          status: 'active',
          joining_date: '',
        });
        setSelectedExecIds([]);
      }
      setExecSearch('');
    }
  }, [open, user, reset, roles]);

  const toggleExecSelection = (id) => {
    setSelectedExecIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredExecutives = useMemo(() => {
    if (!technicalExecutives) return [];
    const activeTechs = technicalExecutives.filter(e => (e.status ? e.status === 'active' : true));
    if (!execSearch.trim()) return activeTechs;
    const term = execSearch.toLowerCase();
    return activeTechs.filter(e =>
      e.full_name?.toLowerCase().includes(term) ||
      e.email?.toLowerCase().includes(term) ||
      e.area?.toLowerCase().includes(term) ||
      e.mobile?.includes(term)
    );
  }, [technicalExecutives, execSearch]);

  const selectAllUnassigned = () => {
    const unassignedIds = (technicalExecutives || [])
      .filter(e => (e.status ? e.status === 'active' : true) && (!e.manager_id || (user && e.manager_id === user.id)))
      .map(e => e.id);
    setSelectedExecIds(Array.from(new Set([...selectedExecIds, ...unassignedIds])));
  };

  const clearAllSelected = () => {
    setSelectedExecIds([]);
  };

  const onSubmit = async (formData) => {
    setLoading(true);
    try {
      const payload = {
        full_name: formData.full_name,
        mobile: formData.mobile,
        role_id: Number(formData.role_id),
        status: formData.status || 'active',
        department: formData.department || null,
        joining_date: formData.joining_date || null,
        region: isAsm ? (formData.region || null) : null,
        area: isTechExec ? (formData.area || null) : null,
        manager_id: isTechExec && formData.manager_id ? Number(formData.manager_id) : (formData.manager_id ? Number(formData.manager_id) : null),
      };

      if (isAsm) {
        payload.executive_ids = selectedExecIds;
      }

      if (isEdit) {
        await userApi.update(user.id, payload);
        toast.success('User updated successfully');
      } else {
        payload.email = formData.email;
        await userApi.create(payload);
        toast.success('User created. Default password: Welcome@123');
      }

      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit User Details' : 'Create New User'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Section 1: Basic Information */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <UsersIcon className="w-3.5 h-3.5" /> Basic Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="label">Full Name <span className="text-red-500">*</span></label>
              <input
                {...register('full_name', { required: 'Full name is required' })}
                className="input"
                placeholder="e.g. Ramesh Kumar"
              />
              {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="label">Email Address <span className="text-red-500">*</span></label>
              <input
                type="email"
                disabled={isEdit}
                {...register('email', { required: !isEdit && 'Email is required' })}
                className={`input ${isEdit ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                placeholder="user@example.com"
              />
              {isEdit && <p className="text-[11px] text-gray-400 mt-1">Email cannot be modified.</p>}
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Mobile Number <span className="text-red-500">*</span></label>
              <input
                {...register('mobile', { required: 'Mobile number is required' })}
                className="input font-mono"
                placeholder="e.g. 9876543210"
              />
              {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile.message}</p>}
            </div>

            <div>
              <label className="label">Role Assignment <span className="text-red-500">*</span></label>
              <select
                {...register('role_id', { required: 'Role is required' })}
                className="input font-medium"
              >
                <option value="">Select role</option>
                {roles?.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.display_name} {r.name === 'sales_manager' ? '(ASM)' : r.name === 'sales_executive' ? '(Technical Executive)' : ''}
                  </option>
                ))}
              </select>
              {errors.role_id && <p className="text-xs text-red-500 mt-1">{errors.role_id.message}</p>}
            </div>

            <div>
              <label className="label">Account Status</label>
              <select {...register('status')} className="input">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: ASM Specific Setup */}
        {isAsm && (
          <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3.5 sm:p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-blue-900 font-semibold text-sm">
              <span className="p-1 rounded-md bg-blue-100 text-blue-700">
                <UsersIcon className="w-4 h-4" />
              </span>
              Area Sales Manager (ASM) Territory & Team
            </div>

            <div>
              <label className="label text-blue-950 font-medium">
                Assigned Region <span className="text-red-500">*</span>
              </label>
              <input
                {...register('region', { required: isAsm && 'Assigned region is required for ASM' })}
                className="input bg-white"
                placeholder="e.g. Nellore Region, South Coast Zone, Krishna District"
              />
              {errors.region && <p className="text-xs text-red-500 mt-1">{errors.region.message}</p>}
              <p className="text-[11px] text-gray-500 mt-1">Territory or region managed by this ASM.</p>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                <label className="label text-blue-950 font-medium !mb-0">
                  Assign Technical Executives ({selectedExecIds.length} selected)
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAllUnassigned}
                    className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                  >
                    Select Unassigned
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={clearAllSelected}
                    className="text-gray-500 hover:text-gray-700 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={execSearch}
                  onChange={e => setExecSearch(e.target.value)}
                  placeholder="Filter executives by name, area, or mobile..."
                  className="input pl-8 py-1.5 text-xs bg-white"
                />
                {execSearch && (
                  <button
                    type="button"
                    onClick={() => setExecSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto border border-blue-200/80 rounded-lg bg-white divide-y divide-gray-100 shadow-inner">
                {filteredExecutives.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">
                    No technical executives found matching "{execSearch}"
                  </div>
                ) : (
                  filteredExecutives.map(exec => {
                    const isChecked = selectedExecIds.includes(exec.id);
                    const isAssignedElsewhere = exec.manager_id && (!user || exec.manager_id !== user.id);

                    return (
                      <label
                        key={exec.id}
                        className={`flex items-center justify-between gap-2 p-2.5 hover:bg-blue-50/40 cursor-pointer text-xs transition select-none ${
                          isChecked ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleExecSelection(exec.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-medium text-gray-900 block sm:inline truncate">{exec.full_name}</span>
                            <span className="text-gray-400 text-[11px] sm:ml-2 font-mono">({exec.mobile})</span>
                            {exec.area && (
                              <span className="sm:ml-2 inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-medium border border-emerald-200">
                                <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                                <span>{exec.area}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {isChecked ? (
                            <span className="text-[10px] text-blue-700 bg-blue-100 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" /> Reporting
                            </span>
                          ) : isAssignedElsewhere ? (
                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              ASM: {exec.manager_name || 'Other'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Unassigned</span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                Checked executives will have their reporting manager set to this ASM.
              </p>
            </div>
          </div>
        )}

        {/* Section 2: Technical Executive Specific Setup */}
        {isTechExec && (
          <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3.5 sm:p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
              <span className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                <MapPin className="w-4 h-4" />
              </span>
              Technical Executive Territory & Reporting
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label text-emerald-950 font-medium">
                  Assigned Area <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('area', { required: isTechExec && 'Area is required for Technical Executive' })}
                  className="input bg-white"
                  placeholder="e.g. Kavali, Bapatla, Bhimavaram"
                />
                {errors.area && <p className="text-xs text-red-500 mt-1">{errors.area.message}</p>}
                <p className="text-[11px] text-gray-500 mt-1">Field territory assigned to this executive.</p>
              </div>

              <div>
                <label className="label text-emerald-950 font-medium">
                  Assign under ASM <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('manager_id', { required: isTechExec && 'Please select reporting ASM' })}
                  className="input bg-white font-medium"
                >
                  <option value="">Select ASM (Area Sales Manager)</option>
                  {asms?.filter(m => (m.status ? m.status === 'active' : true))?.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} {m.region ? `— Region: ${m.region}` : ''}
                    </option>
                  ))}
                </select>
                {errors.manager_id && <p className="text-xs text-red-500 mt-1">{errors.manager_id.message}</p>}
                <p className="text-[11px] text-gray-500 mt-1">ASM this executive reports to.</p>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Additional Employment Details */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Additional Info
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {!isAsm && !isTechExec && (
              <div>
                <label className="label">Reporting Manager</label>
                <select {...register('manager_id')} className="input">
                  <option value="">No manager</option>
                  {asms?.filter(m => (m.status ? m.status === 'active' : true))?.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} {m.region ? `(${m.region})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Department</label>
              <input {...register('department')} className="input" placeholder="e.g. Field Operations, Sales" />
            </div>
            <div>
              <label className="label">Joining Date</label>
              <input type="date" {...register('joining_date')} className="input" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-secondary !px-4">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary !px-5">
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function UserImportModal({ open, onClose, onImportSuccess, roles, asms }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (open) {
      setFile(null);
      setResult(null);
      setImporting(false);
      setDownloadingFormat(null);
      setIsDragOver(false);
    }
  }, [open]);

  const handleDownloadTemplate = async (format) => {
    try {
      setDownloadingFormat(format);
      const headers = [
        { text: 'Full Name', mandatory: true, width: 22 },
        { text: 'Email', mandatory: true, width: 28 },
        { text: 'Mobile', mandatory: true, width: 16 },
        { text: 'Role', mandatory: true, width: 20 },
        { text: 'Region', mandatory: false, width: 20 },
        { text: 'Area', mandatory: false, width: 18 },
        { text: 'Department', mandatory: false, width: 18 },
        { text: 'Reporting Manager Email', mandatory: false, width: 28 },
        { text: 'Joining Date', mandatory: false, width: 16 },
      ];

      if (format === 'csv') {
        const csvContent =
          '\uFEFF' +
          headers.map((h) => (h.mandatory ? `"${h.text} *"` : `"${h.text}"`)).join(',') +
          '\r\n';
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, 'users_template.csv');
      } else {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Royals Marine Food CRM';
        wb.created = new Date();
        const ws = wb.addWorksheet('Users Template');

        headers.forEach((col, idx) => {
          const cell = ws.getCell(1, idx + 1);
          if (col.mandatory) {
            cell.value = {
              richText: [
                { text: col.text + ' ', font: { bold: true, color: { argb: 'FF1F2937' }, size: 11 } },
                { text: '*', font: { bold: true, color: { argb: 'FFDC2626' }, size: 11 } },
              ],
            };
          } else {
            cell.value = col.text;
            cell.font = { bold: true, color: { argb: 'FF1F2937' }, size: 11 };
          }
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' },
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'medium', color: { argb: 'FF9CA3AF' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          ws.getColumn(idx + 1).width = col.width;
        });

        ws.getRow(1).height = 28;

        // Role dropdown list stored in hidden sheet for 100% reliable Excel data validation
        const lookupWs = wb.addWorksheet('_Roles');
        lookupWs.state = 'veryHidden';
        const roleOptions = ['ASM', 'Technical Executive', 'Admin'];
        roleOptions.forEach((role, idx) => {
          lookupWs.getCell(idx + 1, 1).value = role;
        });

        // In-cell Role Dropdown Validation for Column D (Rows 2 to 1000)
        ws.dataValidations.add('D2:D1000', {
          type: 'list',
          allowBlank: true,
          formulae: ['_Roles!$A$1:$A$3'],
          showErrorMessage: true,
          errorTitle: 'Invalid Role',
          error: 'Please choose a valid role from the dropdown list.',
        });

        // No raw dummy data rows! Template is ready for user input.
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        downloadBlob(blob, 'users_template.xlsx');
      }
      toast.success(`Downloaded ${format.toUpperCase()} template`);
    } catch {
      toast.error(`Failed to download ${format.toUpperCase()} template`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const name = selected.name.toLowerCase();
      if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
        toast.error('Please select an Excel (.xlsx, .xls) or CSV (.csv) file');
        return;
      }
      setFile(selected);
      setResult(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      const name = dropped.name.toLowerCase();
      if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
        toast.error('Please drop an Excel (.xlsx, .xls) or CSV (.csv) file');
        return;
      }
      setFile(dropped);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file to import');
      return;
    }
    setImporting(true);
    try {
      // 1. Try server-side import first
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await userApi.import(fd);
        const data = res.data?.data || {};
        setResult(data);
        if (data.imported > 0) {
          toast.success(`Successfully imported ${data.imported} users`);
          onImportSuccess?.();
        } else {
          toast.error('No new users were imported');
        }
        return;
      } catch (serverErr) {
        // If server returns 404 (e.g. remote backend not yet redeployed), fallback to client-side parsing
        if (serverErr.response?.status !== 404) {
          throw serverErr;
        }
      }

      // 2. Client-side fallback if server-side route is not yet deployed
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (!rawRows || rawRows.length < 2) {
        throw new Error('The uploaded file is empty or contains no data rows');
      }

      const headerRow = rawRows[0] || [];
      const colMap = {};
      headerRow.forEach((cell, idx) => {
        const clean = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clean.includes('fullname') || clean === 'name') colMap.full_name = idx;
        else if (clean.includes('email') && !clean.includes('manager')) colMap.email = idx;
        else if (clean.includes('mobile') || clean.includes('phone')) colMap.mobile = idx;
        else if (clean.includes('role')) colMap.role = idx;
        else if (clean.includes('region')) colMap.region = idx;
        else if (clean.includes('area')) colMap.area = idx;
        else if (clean.includes('department') || clean.includes('dept')) colMap.department = idx;
        else if (clean.includes('manager') || clean.includes('reporting')) colMap.manager_email = idx;
        else if (clean.includes('date') || clean.includes('joining')) colMap.joining_date = idx;
        else if (clean.includes('pass')) colMap.password = idx;
      });

      const colFullName = colMap.full_name ?? 0;
      const colEmail = colMap.email ?? 1;
      const colMobile = colMap.mobile ?? 2;
      const colRole = colMap.role ?? 3;
      const colRegion = colMap.region ?? 4;
      const colArea = colMap.area ?? 5;
      const colDept = colMap.department ?? 6;
      const colManager = colMap.manager_email ?? 7;
      const colJoining = colMap.joining_date ?? 8;
      const colPassword = colMap.password ?? 9;

      const salesManagerRole = roles?.find(r => r.name === 'sales_manager');
      const salesExecutiveRole = roles?.find(r => r.name === 'sales_executive');

      const resolveRoleId = (str) => {
        if (!str) return salesExecutiveRole?.id;
        const clean = String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (['asm', 'salesmanager', 'areamanager', 'areasalesmanager'].includes(clean)) return salesManagerRole?.id;
        if (['tech', 'salesexecutive', 'technicalexecutive', 'fieldexecutive', 'executive'].includes(clean)) return salesExecutiveRole?.id;
        const matched = roles?.find(r => r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean || r.display_name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
        return matched ? matched.id : salesExecutiveRole?.id;
      };

      const asmEmailToId = new Map();
      asms?.forEach(a => {
        if (a.email) asmEmailToId.set(a.email.toLowerCase().trim(), a.id);
      });

      const summary = { total: rawRows.length - 1, imported: 0, skipped: 0, errors: [] };

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) {
          summary.total--;
          continue;
        }

        const fullName = String(row[colFullName] || '').trim();
        const email = String(row[colEmail] || '').trim().toLowerCase();
        const mobile = String(row[colMobile] || '').trim();
        const roleStr = String(row[colRole] || '').trim();
        const region = String(row[colRegion] || '').trim() || null;
        const area = String(row[colArea] || '').trim() || null;
        const department = String(row[colDept] || '').trim() || null;
        const managerEmail = String(row[colManager] || '').trim().toLowerCase();
        let joiningDate = String(row[colJoining] || '').trim() || null;
        const password = String(row[colPassword] || '').trim() || 'Welcome@123';

        if (!fullName && !email && !mobile) {
          summary.total--;
          continue;
        }

        if (!fullName) {
          summary.errors.push({ row: i + 1, error: 'Full Name is required' });
          summary.skipped++;
          continue;
        }

        if (!email || !email.includes('@')) {
          summary.errors.push({ row: i + 1, error: `Valid Email is required: "${email}"` });
          summary.skipped++;
          continue;
        }

        if (!mobile) {
          summary.errors.push({ row: i + 1, error: 'Mobile number is required' });
          summary.skipped++;
          continue;
        }

        const roleId = resolveRoleId(roleStr);
        let managerId = null;
        if (managerEmail && asmEmailToId.has(managerEmail)) {
          managerId = asmEmailToId.get(managerEmail);
        }

        if (joiningDate) {
          const d = new Date(joiningDate);
          if (!isNaN(d.getTime())) joiningDate = d.toISOString().split('T')[0];
          else joiningDate = null;
        }

        try {
          const res = await userApi.create({
            full_name: fullName,
            email,
            mobile,
            role_id: roleId,
            region,
            area,
            department,
            manager_id: managerId,
            joining_date: joiningDate,
            password,
          });
          const createdUser = res.data?.data;
          if (createdUser?.id && (roleId === salesManagerRole?.id || roleStr.toLowerCase().includes('asm'))) {
            asmEmailToId.set(email, createdUser.id);
          }
          summary.imported++;
        } catch (err) {
          summary.errors.push({ row: i + 1, error: err.response?.data?.message || err.message });
          summary.skipped++;
        }
      }

      setResult(summary);
      if (summary.imported > 0) {
        toast.success(`Successfully imported ${summary.imported} users`);
        onImportSuccess?.();
      } else {
        toast.error('No new users were imported');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to import users');
    } finally {
      setImporting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Modal
      open={open}
      onClose={importing ? () => {} : onClose}
      title="Bulk Import Users"
      size="md"
    >
      <div className="space-y-4">
        {/* Minimal Template Download Row */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <span className="text-xs text-gray-500 font-medium">Templates:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={Boolean(downloadingFormat)}
              onClick={() => handleDownloadTemplate('xlsx')}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1.5 rounded-lg transition inline-flex items-center gap-1.5"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5 text-emerald-600" />
              {downloadingFormat === 'xlsx' ? 'Downloading...' : 'Excel (.xlsx)'}
            </button>
            <button
              type="button"
              disabled={Boolean(downloadingFormat)}
              onClick={() => handleDownloadTemplate('csv')}
              className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-2.5 py-1.5 rounded-lg transition inline-flex items-center gap-1.5"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5 text-blue-600" />
              {downloadingFormat === 'csv' ? 'Downloading...' : 'CSV (.csv)'}
            </button>
          </div>
        </div>

        {/* Upload Drop Zone */}
        {!result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/50'
                : file
                ? 'border-emerald-300 bg-emerald-50/30'
                : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <div className="space-y-1">
                <CheckCircleIcon className="w-8 h-8 mx-auto text-emerald-600" />
                <p className="text-xs font-semibold text-gray-800">{file.name}</p>
                <p className="text-[11px] text-gray-400">{formatFileSize(file.size)}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="text-xs text-red-600 hover:underline font-medium pt-1 inline-block"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <ArrowUpTrayIcon className="w-6 h-6 mx-auto text-gray-400" />
                <p className="text-xs font-medium text-gray-700">
                  Select or drag & drop Excel / CSV file
                </p>
                <p className="text-[11px] text-gray-400">
                  Default password: <span className="font-mono text-gray-500">Welcome@123</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Results View */}
        {result && (
          <div className="space-y-3.5">
            <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-4 text-center space-y-1.5">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-0.5">
                <CheckCircleIcon className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-emerald-900">
                {result.imported} {result.imported === 1 ? 'User' : 'Users'} Added Successfully
              </p>
              <p className="text-xs text-emerald-700">
                Default password: <span className="font-mono font-semibold bg-white border border-emerald-200 px-1.5 py-0.5 rounded text-emerald-900">Welcome@123</span>
              </p>
              <p className="text-[11px] text-emerald-600">
                Users can log in with their email and change their password anytime in Settings.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                <p className="text-xl font-bold text-blue-700">{result.total}</p>
                <p className="text-[11px] text-blue-600">Total Rows</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
                <p className="text-xl font-bold text-emerald-700">{result.imported}</p>
                <p className="text-[11px] text-emerald-600">Imported</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                <p className="text-xl font-bold text-amber-700">{result.skipped}</p>
                <p className="text-[11px] text-amber-600">Skipped</p>
              </div>
            </div>

            {result.skipped > 0 && (
              <p className="text-xs text-amber-700 text-center font-medium bg-amber-50 border border-amber-100 rounded-lg p-2">
                {result.skipped} {result.skipped === 1 ? 'row was' : 'rows were'} skipped (email already registered or missing required fields).
              </p>
            )}
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          {result ? (
            <button
              type="button"
              onClick={onClose}
              className="btn-primary btn-sm !px-4"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="btn-secondary btn-sm !px-3"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || !file}
                className="btn-primary btn-sm !px-4 inline-flex items-center gap-1.5"
              >
                {importing ? 'Importing...' : 'Upload & Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function Users() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const getRoleFromParam = (param) => {
    if (!param) return '';
    const lower = param.toLowerCase().trim();
    if (lower === 'asm' || lower === 'sales_manager' || lower === 'area_manager') return 'sales_manager';
    if (lower === 'tech' || lower === 'sales_executive' || lower === 'technical_executive' || lower === 'field_executive') return 'sales_executive';
    return param;
  };

  const initialRole = getRoleFromParam(searchParams.get('role'));
  const [page, setPage] = useState(1);
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam !== null) {
      const normalized = getRoleFromParam(roleParam);
      if (normalized !== role) {
        setRole(normalized);
        setPage(1);
      }
    }
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, role, status, search],
    queryFn: () => userApi.list({ page, limit: 20, role, status, search }).then(r => r.data),
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => userApi.roles().then(r => r.data.data),
  });

  const { data: asms } = useQuery({
    queryKey: ['asms'],
    queryFn: () => userApi.list({ role: 'sales_manager', status: 'active', limit: 100 }).then(r => r.data.data),
  });

  const { data: technicalExecutives } = useQuery({
    queryKey: ['technicalExecutives'],
    queryFn: () => userApi.list({ role: 'sales_executive', status: 'active', limit: 100 }).then(r => r.data.data),
  });

  const toggleStatus = async (user) => {
    try {
      await userApi.update(user.id, {
        ...user,
        status: user.status === 'active' ? 'inactive' : 'active',
        role_id: user.role_id || roles?.find(r => r.name === user.role)?.id,
      });
      toast.success('User status updated');
      qc.invalidateQueries(['users']);
      qc.invalidateQueries(['asms']);
      qc.invalidateQueries(['technicalExecutives']);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const openAddModal = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  const handleSaved = () => {
    qc.invalidateQueries(['users']);
    qc.invalidateQueries(['asms']);
    qc.invalidateQueries(['technicalExecutives']);
  };

  return (
    <div className="space-y-4">
      {/* Minimal Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Users</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} team members registered
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setImportModalOpen(true)}
            className="btn-secondary btn-sm inline-flex items-center gap-1.5"
            title="Import users in bulk from Excel or CSV"
          >
            <ArrowUpTrayIcon className="w-4 h-4 text-gray-600" />
            <span>Import Users</span>
          </button>
          <button
            onClick={openAddModal}
            className="btn-primary btn-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <FilterBar
        onSearch={setSearch}
        searchValue={search}
        onReset={() => {
          setRole('');
          setStatus('');
          setSearch('');
          setPage(1);
          setSearchParams({});
        }}
      >
        <SelectFilter
          label="All Roles"
          value={role}
          onChange={(newRole) => {
            setRole(newRole);
            setPage(1);
            setSearchParams(prev => {
              const updated = new URLSearchParams(prev);
              if (newRole) updated.set('role', newRole);
              else updated.delete('role');
              return updated;
            });
          }}
          options={roles?.map(r => ({
            value: r.name,
            label: r.name === 'sales_manager' ? 'ASM (Area Sales Manager)' : r.name === 'sales_executive' ? 'Technical Executive' : r.display_name,
          })) || []}
        />
        <SelectFilter
          label="All Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </FilterBar>

      {/* Main Content Area */}
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="card overflow-hidden">
          {data?.data?.length === 0 ? (
            <EmptyState
              title="No users found"
              description="No users matched your search and filter criteria."
              icon={UsersIcon}
              action={<button onClick={openAddModal} className="btn-primary btn-sm">Add User</button>}
            />
          ) : (
            <>
              {/* Table View */}
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Territory / Area</th>
                      <th>Reporting / Team</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map(u => {
                      const isAsmUser = u.role === 'sales_manager';
                      const isTechExecUser = u.role === 'sales_executive';

                      return (
                        <tr
                          key={u.id}
                          onClick={() => navigate(`/users/${u.id}`)}
                          className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                        >
                          <td className="font-medium text-gray-900 whitespace-nowrap text-sm">
                            {u.full_name}
                          </td>
                          <td className="whitespace-nowrap text-xs text-gray-600">
                            {u.role_display}
                          </td>
                          <td className="text-gray-500 whitespace-nowrap text-xs">{u.email || '—'}</td>
                          <td className="text-gray-500 font-mono text-xs whitespace-nowrap">{u.mobile || '—'}</td>
                          <td className="text-gray-500 whitespace-nowrap text-xs">
                            {isAsmUser ? (u.region || '—') : isTechExecUser ? (u.area || '—') : (u.department || '—')}
                          </td>
                          <td className="text-gray-500 whitespace-nowrap text-xs">
                            {isAsmUser
                              ? (u.assigned_executives_count > 0 ? `${u.assigned_executives_count} execs` : '0 execs')
                              : isTechExecUser
                              ? (u.manager_name ? `ASM: ${u.manager_name}` : 'Unassigned')
                              : (u.manager_name || '—')}
                          </td>
                          <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => toggleStatus(u)}
                              className="text-xs font-medium text-gray-700 hover:text-gray-900 transition cursor-pointer"
                              title="Click to toggle status"
                            >
                              <span className={u.status === 'active' ? 'text-gray-800' : 'text-gray-400'}>
                                {u.status === 'active' ? 'Active' : 'Inactive'}
                              </span>
                            </button>
                          </td>
                          <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openEditModal(u)}
                              className="btn-secondary !py-1 !px-2.5 text-xs font-medium text-gray-700 hover:text-gray-900"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Pagination */}
              <Pagination meta={data.pagination} onPageChange={setPage} />
            </>
          )}
        </div>
      )}

      {/* User Modal */}
      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        user={editingUser}
        roles={roles}
        asms={asms}
        technicalExecutives={technicalExecutives}
        onSaved={handleSaved}
      />

      {/* Bulk Import Users Modal */}
      <UserImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={handleSaved}
        roles={roles}
        asms={asms}
      />
    </div>
  );
}
