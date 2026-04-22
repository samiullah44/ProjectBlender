import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Newsletter } from './models/Newsletter';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Database connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Fatal Error: MONGODB_URI is not defined.');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB (Newsletter DB)'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.post('/api/newsletter/subscribe', async (req: Request, res: Response) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database connecting... please try again in a moment.' });
  }
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if email already exists
    const existingSubscriber = await Newsletter.findOne({ email });
    if (existingSubscriber) {
      if (existingSubscriber.status === 'unsubscribed') {
        existingSubscriber.status = 'subscribed';
        if (role) existingSubscriber.role = role;
        await existingSubscriber.save();
        return res.status(200).json({ success: true, message: 'Successfully resubscribed.' });
      }
      // Update role if changed
      if (role && existingSubscriber.role !== role) {
        existingSubscriber.role = role;
        await existingSubscriber.save();
      }
      // If already subscribed, return 200 to prevent error cascades for the user, but note it
      return res.status(200).json({ success: true, message: 'Email is already subscribed.' });
    }

    // Create new subscriber
    const newSubscriber = new Newsletter({ email, role });
    await newSubscriber.save();

    return res.status(201).json({ success: true, message: 'Successfully subscribed to waitlist.' });

  } catch (error) {
    console.error('Newsletter Subscription Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while subscribing.' });
  }
});

app.get('/api/newsletter/count', async (req: Request, res: Response) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database connecting...', count: 0 });
  }
  try {
    const count = await Newsletter.countDocuments({ status: 'subscribed' });
    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error('Newsletter Count Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'newsletter-api' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Newsletter Microservice running on http://localhost:${PORT}`);
});
