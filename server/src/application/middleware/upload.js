import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure upload and temp directories exist
const uploadsDir = path.join(process.cwd(), 'uploads');
const tempDir = path.join(process.cwd(), 'temp');

// Create directories if they don't exist silently
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });
} catch {
  // directory exists or permission handled
}

// Configure memory storage to handle file buffers
const storage = multer.memoryStorage();

// File filter for images
const fileFilter = (req, file, cb) => {
  const filetypes = /jpe?g|png|webp/;
  const mimetypes = /^image\/(jpe?g|png|webp)$/i;

  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = mimetypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpg, .jpeg, .png, and .webp formats are allowed!'), false);
  }
};

// Initialize upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Middleware to clean up temp files
const cleanupTempFiles = (req, res, next) => {
  // Clean up any temporary files after response is sent
  res.on('finish', () => {
    if (req.file && req.file.path && req.file.path.startsWith(tempDir)) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error cleaning up temp file:', err);
      });
    }
  });
  next();
};

// Export both upload and cleanup middleware
export { upload, cleanupTempFiles };

export default upload;
