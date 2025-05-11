const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors'); // Import CORS middleware
const User = require('./models/User');
const Wallet = require('./models/Wallet');
const Transaction = require('./models/Transaction');
const Referral = require('./models/Referral');  // Add referral model
const Milestone = require('./models/Milestone');  // Add milestone model
const { Investment } = require('./models/Investment'); // Add Investment model
const authRoutes = require('./routes/authRoutes');
const walletRoutes = require('./routes/walletRoutes');
const referralRoutes = require('./routes/referralRoutes');  // Add referral routes
const investmentRoutes = require('./routes/investmentRoutes'); // Add investment routes
const dashboardRoutes = require('./routes/dashboardRoutes'); // Add dashboard routes
const notificationRoutes = require('./routes/notificationRoutes'); // Add notification routes
const adminRoutes = require('./routes/adminRoutes'); // Add admin routes
const { createProcessedTransactionsTable } = require('./utils/tronUtill');
const { setupScheduler } = require('./jobs/scheduler');
const { authenticateToken } = require('./middleware/authmiddleware');
const { getProcessedTransactions } = require('./utils/tronUtill');
const Notification = require('./models/Notification'); // Add this line
const fs = require('fs');

// Load env vars
dotenv.config();

const app = express();

// Enable CORS for all routes
app.use(cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// In your database initialization
try {
  User.createTable();
  Wallet.createTable();
  Transaction.createTable();
  Referral.createTable();  // Initialize referral table
  Milestone.createTable();  // Initialize milestone table
  Investment.createTable(); // Initialize investment table
  createProcessedTransactionsTable();
  Notification.createTable();
  console.log('Database tables initialized');
  const seedNotifications = require('./seeders/notificationSeeder');
seedNotifications();
} catch (error) {
  console.error('Error initializing database tables:', error);
}
Transaction.ensureSchema();


if (process.env.NODE_ENV !== 'test') {
  setupScheduler();
}

// Use wallet routes
app.use('/api/wallet', walletRoutes);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

// Serve static files from the public directory
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Also serve files from the API's public directory (for uploads)
app.use(express.static(path.join(__dirname, 'public')));

// Use auth routes
app.use('/api/auth', authRoutes);

// Use referral routes
app.use('/api/referrals', referralRoutes);

// Use investment routes
app.use('/api/investment', investmentRoutes);

// Use settings routes
app.use('/api/settings', require('./routes/settingsRoutes'));

// Use profile routes
app.use('/api/profile', require('./routes/profileRoutes'));

// Use dashboard routes
app.use('/api/dashboard', dashboardRoutes);

// Use notification routes
app.use('/api/notifications', notificationRoutes);

// Use admin routes
app.use('/api/admin', adminRoutes);

//Use transaction

// Test route
app.get('/test', (req, res) => {
  res.send('Test works');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});