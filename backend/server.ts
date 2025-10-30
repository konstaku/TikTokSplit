import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

app.use(express.json());

// Simple request logger for debugging
app.use((req: Request, res: Response, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/public', express.static(path.join(__dirname, 'public')));

// Import API routes
import videoRoutes from './src/routes/video';
import newsRoutes from './src/routes/news';
app.use('/api/video', videoRoutes);
app.use('/api/news', newsRoutes);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tiktok-blend')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err: any) => {
    console.error('MongoDB connection error:', err);
  });

// Root and health checks
app.get('/', (req: Request, res: Response) => res.json({ status: 'ok' }));
app.get('/api/health', (req: Request, res: Response) =>
  res.json({ status: 'ok' })
);

// 404 handler to confirm unmatched routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
