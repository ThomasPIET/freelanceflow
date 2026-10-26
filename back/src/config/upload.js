const multer = require('multer');
const path = require('path');

const MAX_SIZE_MB = 2;
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      Object.assign(new Error('Format non supporté. Formats acceptés : jpg, jpeg, png'), {
        status: 400,
      })
    );
  }
  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
});

module.exports = upload;
