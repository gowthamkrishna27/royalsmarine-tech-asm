-- Rupa Enterprises CRM - Database Schema
-- MySQL 8.0+


-- ============================================================
-- ROLES & PERMISSIONS
-- ============================================================
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_module_action (module, action)
);

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  mobile VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  manager_id INT NULL,
  department VARCHAR(100),
  status ENUM('active','inactive') DEFAULT 'active',
  joining_date DATE,
  last_login TIMESTAMP NULL,
  password_reset_token VARCHAR(255) NULL,
  password_reset_expires TIMESTAMP NULL,
  refresh_token TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_email (email),
  INDEX idx_role_id (role_id),
  INDEX idx_manager_id (manager_id),
  INDEX idx_status (status)
);

-- ============================================================
-- FARMERS (FORMERLY CLIENTS)
-- ============================================================
CREATE TABLE farmers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  company_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(150),
  designation VARCHAR(100),
  mobile VARCHAR(20),
  alternate_mobile VARCHAR(20),
  email VARCHAR(150),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  gps_address TEXT,
  industry_type VARCHAR(100),
  client_type ENUM('existing_client','new_prospect','retailer','corporate','distributor','government','other') DEFAULT 'new_prospect',
  assigned_salesperson_id INT NULL,
  assigned_manager_id INT NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  notes TEXT,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (assigned_salesperson_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_manager_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_company_name (company_name),
  INDEX idx_mobile (mobile),
  INDEX idx_email (email),
  INDEX idx_city (city),
  INDEX idx_state (state),
  INDEX idx_salesperson (assigned_salesperson_id),
  INDEX idx_client_type (client_type),
  INDEX idx_status (status)
);

CREATE OR REPLACE VIEW clients AS SELECT * FROM farmers;

-- ============================================================
-- PONDS (FARMER PONDS)
-- ============================================================
CREATE TABLE ponds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  client_id INT NOT NULL,
  pond_name VARCHAR(100) NOT NULL,
  area_acres DECIMAL(8,2) NULL,
  culture_type VARCHAR(100) NULL,
  water_type VARCHAR(100) NULL,
  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  gps_address TEXT NULL,
  status ENUM('active','fallow','nursery','harvested','inactive') DEFAULT 'active',
  remarks TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (client_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_pond_client (client_id),
  INDEX idx_pond_status (status)
);

-- ============================================================
-- VISITS
-- ============================================================
CREATE TABLE visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  visit_date DATE NOT NULL,
  visit_time TIME NOT NULL,
  salesperson_id INT NOT NULL,
  client_id INT NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  gps_address TEXT,
  gps_captured_at TIMESTAMP NULL,
  gps_denied_reason TEXT,
  person_met VARCHAR(150),
  designation_met VARCHAR(100),
  meeting_type VARCHAR(100) NOT NULL DEFAULT 'casual',
  meeting_highlights TEXT,
  remarks TEXT,
  visit_outcome TEXT,
  next_action TEXT,
  next_followup_date DATE,
  tank_id INT NULL,
  tank_number VARCHAR(100) NULL,
  water_quality JSON NULL,
  feeding_details JSON NULL,
  medication_details JSON NULL,
  harvest_details JSON NULL,
  approval_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  rejection_reason TEXT,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (salesperson_id) REFERENCES users(id),
  FOREIGN KEY (client_id) REFERENCES farmers(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_salesperson (salesperson_id),
  INDEX idx_client (client_id),
  INDEX idx_visit_date (visit_date),
  INDEX idx_approval_status (approval_status)
);

CREATE TABLE visit_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  visit_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100),
  file_size INT,
  file_path VARCHAR(500) NOT NULL,
  uploaded_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- FOLLOW-UPS
-- ============================================================
CREATE TABLE followups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  client_id INT NOT NULL,
  visit_id INT NULL,
  opportunity_id INT NULL,
  assigned_salesperson_id INT NOT NULL,
  followup_date DATE NOT NULL,
  followup_time TIME NULL,
  priority ENUM('low','medium','high') DEFAULT 'medium',
  status ENUM('pending','completed','overdue','cancelled') DEFAULT 'pending',
  remarks TEXT,
  completion_notes TEXT,
  completed_date TIMESTAMP NULL,
  escalated_to INT NULL,
  escalated_at TIMESTAMP NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (client_id) REFERENCES farmers(id),
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_salesperson_id) REFERENCES users(id),
  FOREIGN KEY (escalated_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_salesperson (assigned_salesperson_id),
  INDEX idx_client (client_id),
  INDEX idx_followup_date (followup_date),
  INDEX idx_status (status),
  INDEX idx_priority (priority)
);



-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('followup','visit','opportunity','system','escalation') DEFAULT 'system',
  reference_type VARCHAR(50),
  reference_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_created (created_at)
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(100) NOT NULL,
  record_id INT,
  old_value JSON,
  new_value JSON,
  performed_by INT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_module_record (module, record_id),
  INDEX idx_performed_by (performed_by),
  INDEX idx_created (created_at)
);

-- ============================================================
-- SETTINGS
-- ============================================================
CREATE TABLE settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(100) NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO roles (name, display_name, description) VALUES
('super_admin', 'Super Admin', 'Full system access'),
('admin', 'Admin', 'Manage users, clients, brands, reports'),
('sales_manager', 'Sales Manager', 'View team, monitor pipeline, approve visits'),
('sales_executive', 'Sales Executive', 'Add visits, clients, opportunities'),
('backend_ops', 'Backend / Operations', 'Manage quotations, POs, billing imports'),
('management', 'Management / Viewer', 'View-only dashboards and reports');

INSERT INTO settings (key_name, value, description) VALUES
('followup_overdue_escalation_days', '2', 'Days after which overdue followup is escalated'),
('company_name', 'Rupa Enterprises', 'Company name'),
('company_email', 'info@rupaenterprises.com', 'Company email'),
('smtp_configured', 'false', 'Whether SMTP is configured');
