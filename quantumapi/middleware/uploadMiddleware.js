const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Ensure upload directories exist
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    console.log(`Created directory: ${directory}`);
  }
};

// Define storage locations with absolute paths
const UPLOAD_PATHS = {
  profilePictures: path.join(__dirname, '../public/uploads/profile-pictures/'),
  documents: path.join(__dirname, '../public/uploads/documents/'),
  temp: path.join(__dirname, '../public/uploads/temp/')
};

// Create directories if they don't exist
Object.values(UPLOAD_PATHS).forEach(ensureDirectoryExists);

// Configure multer storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    // Determine the correct destination based on file type
    let uploadPath = UPLOAD_PATHS.temp;
    
    if (req.path.includes('profile') || req.originalUrl.includes('profile')) {
      uploadPath = UPLOAD_PATHS.profilePictures;
    } else if (req.path.includes('document') || req.originalUrl.includes('verification')) {
      uploadPath = UPLOAD_PATHS.documents;
    }
    
    cb(null, uploadPath);
  },
  filename: function(req, file, cb) {
    // Create unique filename with userId if available
    const userId = req.user ? req.user.id : 'guest';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${userId}-${timestamp}${ext}`);
  }
});

// File filter to validate upload types
const fileFilter = (req, file, cb) => {
  // For profile pictures, only allow images
  if (req.path.includes('profile') || req.originalUrl.includes('profile')) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed for profile pictures'), false);
    }
  }
  
  // Accept the file
  cb(null, true);
};

// Create multer upload instances
const uploadProfilePicture = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: fileFilter
}).single('profilePicture');

const uploadDocument = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
}).single('document');

// Export the middleware functions
module.exports = {
  uploadProfilePicture,
  uploadDocument,
  UPLOAD_PATHS
};