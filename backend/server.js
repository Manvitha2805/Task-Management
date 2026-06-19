import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './src/utils/db.js';

// Import routes
import authRoutes from './src/routes/authRoutes.js';
import attendanceRoutes from './src/routes/attendanceRoutes.js';
import taskRoutes from './src/routes/taskRoutes.js';
import leaveRoutes from './src/routes/leaveRoutes.js';
import internRoutes from './src/routes/internRoutes.js';
import meetingRoutes from './src/routes/meetingRoutes.js';
import settingsRoutes from './src/routes/settingsRoutes.js';
import auditRoutes from './src/routes/auditRoutes.js';
import reportRoutes from './src/routes/reportRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  'http://localhost:3050',
  'http://localhost:3000',
  'https://manvitha2805.github.io',
  'https://Manvitha2805.github.io'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// API Routes mounting
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/interns', internRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reports', reportRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    databaseUrlConfigured: !!process.env.DATABASE_URL,
    version: '1.0.5'
  });
});

app.get('/health-db', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ status: 'ok', userCount, message: 'Database connection successful!' });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Fallback route 404
app.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Task Manager Server running on port ${PORT}`);
});
