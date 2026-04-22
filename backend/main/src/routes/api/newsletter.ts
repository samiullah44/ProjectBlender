import { Router, Request, Response } from 'express';
import { Newsletter } from '../../models/Newsletter';

const router = Router();

// POST /api/newsletter/subscribe
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const existingSubscriber = await Newsletter.findOne({ email });
    if (existingSubscriber) {
      if (existingSubscriber.status === 'unsubscribed') {
        existingSubscriber.status = 'subscribed';
        if (role) existingSubscriber.role = role;
        await existingSubscriber.save();
        return res.status(200).json({ success: true, message: 'Successfully resubscribed.' });
      }
      if (role && existingSubscriber.role !== role) {
        existingSubscriber.role = role;
        await existingSubscriber.save();
      }
      return res.status(200).json({ success: true, message: 'Email is already subscribed.' });
    }

    const newSubscriber = new Newsletter({ email, role });
    await newSubscriber.save();

    return res.status(201).json({ success: true, message: 'Successfully subscribed to waitlist.' });
  } catch (error) {
    console.error('Newsletter Subscription Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while subscribing.' });
  }
});

// GET /api/newsletter/count
router.get('/count', async (req: Request, res: Response) => {
  try {
    const count = await Newsletter.countDocuments({ status: 'subscribed' });
    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error('Newsletter Count Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

export default router;
