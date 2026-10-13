const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
};

const ALL_ALLOWED = [...ALLOWED_TYPES.image, ...ALLOWED_TYPES.document];

const storage = (subfolder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(process.env.UPLOAD_DIR || 'src/uploads', subfolder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, name);
    },
  });

const fileFilter = (types) => (req, file, cb) => {
  if (types.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;

module.exports = {
  visitUpload: multer({
    storage: storage('visits'),
    fileFilter: fileFilter(ALL_ALLOWED),
    limits: { fileSize: maxSize },
  }),
  quotationUpload: multer({
    storage: storage('quotations'),
    fileFilter: fileFilter(ALL_ALLOWED),
    limits: { fileSize: maxSize },
  }),
  poUpload: multer({
    storage: storage('purchase-orders'),
    fileFilter: fileFilter(ALL_ALLOWED),
    limits: { fileSize: maxSize },
  }),
  billingUpload: multer({
    storage: storage('billing'),
    fileFilter: fileFilter([...ALLOWED_TYPES.document]),
    limits: { fileSize: maxSize },
  }),
};
