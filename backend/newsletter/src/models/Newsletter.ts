import mongoose, { Document, Schema } from 'mongoose';

export interface INewsletter extends Document {
  email: string;
  role?: 'artist' | 'provider';
  status: 'subscribed' | 'unsubscribed';
  subscribedAt: Date;
}

const NewsletterSchema: Schema = new Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
  },
  role: {
    type: String,
    enum: ['artist', 'provider'],
    required: false
  },
  status: { 
    type: String, 
    enum: ['subscribed', 'unsubscribed'], 
    default: 'subscribed' 
  },
  subscribedAt: { 
    type: Date, 
    default: Date.now 
  }
});

export const Newsletter = mongoose.model<INewsletter>('Newsletter', NewsletterSchema);
