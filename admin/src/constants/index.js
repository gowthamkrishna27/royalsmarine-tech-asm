export const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/v1`
  : '/api/v1';
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SALES_MANAGER: 'sales_manager',
  SALES_EXECUTIVE: 'sales_executive',
  BACKEND_OPS: 'backend_ops',
  MANAGEMENT: 'management',
};

export const ROLE_LABELS = {
  sales_executive: 'Technical Executive',
  sales_manager: 'Area Executive Manager',
  admin: 'Administrator',
  super_admin: 'Super Admin',
  backend_ops: 'Operations',
  management: 'Management',
};

export const formatRole = (role) => ROLE_LABELS[role] || (role ? role.replace(/_/g, ' ') : '');



export const MEETING_TYPES = [
  { value: 'casual', label: 'Casual Visit' },
  { value: 'water_quality', label: 'Water Quality' },
  { value: 'feeding_details', label: 'Feeding Details' },
  { value: 'medication_details', label: 'Medication & Treatments' },
  { value: 'harvest_details', label: 'Harvest Details' },
  { value: 'all', label: 'All Details (Full Inspection)' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'order_discussion', label: 'Order Discussion' },
  { value: 'other', label: 'Other' },
];

export const CLIENT_TYPES = [
  { value: 'existing_client', label: 'Existing Farmer' },
  { value: 'new_prospect', label: 'New Prospect' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'government', label: 'Government' },
  { value: 'other', label: 'Other' },
];

export const VISIT_APPROVAL = {
  pending: { label: 'Pending', badge: 'badge-yellow' },
  approved: { label: 'Approved', badge: 'badge-green' },
  rejected: { label: 'Rejected', badge: 'badge-red' },
};

export const FOLLOWUP_PRIORITY = {
  low: { label: 'Low', badge: 'badge-gray' },
  medium: { label: 'Medium', badge: 'badge-blue' },
  high: { label: 'High', badge: 'badge-red' },
};

export const FOLLOWUP_STATUS = {
  pending: { label: 'Pending', badge: 'badge-yellow' },
  completed: { label: 'Completed', badge: 'badge-green' },
  overdue: { label: 'Overdue', badge: 'badge-red' },
  cancelled: { label: 'Cancelled', badge: 'badge-gray' },
};


export const POND_STATUSES = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'fallow', label: 'Fallow / Empty', color: 'gray' },
  { value: 'nursery', label: 'Nursery', color: 'blue' },
  { value: 'harvested', label: 'Harvested', color: 'yellow' },
  { value: 'inactive', label: 'Inactive', color: 'red' },
];

export const CULTURE_TYPES = [
  'Vannamei (Whiteleg Shrimp)',
  'Black Tiger Shrimp',
  'Freshwater Prawn (Scampi)',
  'Fish (Tilapia)',
  'Fish (Rohu / Catla / Carp)',
  'Fish (Pangasius / Catfish)',
  'Fish (Seabass / Bhetki)',
  'Polyculture',
  'Other',
];

export const WATER_TYPES = [
  'Brackish Water',
  'Freshwater',
  'Saline / Sea Water',
  'Borewell / Ground Water',
];

export const WATER_SOURCES = [
  { value: 'bore', label: 'Bore' },
  { value: 'creek', label: 'Creek' },
  { value: 'both', label: 'Both' },
];

export const SOIL_TYPES = [
  { value: 'loam', label: 'Loam' },
  { value: 'clay', label: 'Clay' },
  { value: 'sandy', label: 'Sandy' },
];

