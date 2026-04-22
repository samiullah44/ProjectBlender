// backend/src/models/Analytics.ts
import mongoose, { Schema, Document } from 'mongoose';

// ─────────────────────────────────────────────
// Sub-schemas for consistency
// ─────────────────────────────────────────────
const geoSchema = new Schema({
  country:     String,
  countryCode: String,
  region:      String,
  city:        String,
  lat:         Number,
  lon:         Number,
  timezone:    String,
  isp:         String,
}, { _id: false });

const deviceSchema = new Schema({
  type:      { type: String, default: 'unknown' },
  os:        String,
  browser:   String,
  userAgent: String,
  language:  String,
  screenRes: String,
}, { _id: false });

const utmSchema = new Schema({
  source:   String,
  medium:   String,
  campaign: String,
  term:     String,
  content:  String,
}, { _id: false });

// ─────────────────────────────────────────────
// AnalyticsUser – one document per anonymous visitor
// ─────────────────────────────────────────────
export interface IAnalyticsUser extends Document {
   userId: string;           // crypto.randomUUID() stored in localStorage
   registeredUserId?: string; // linked User._id once logged in
   email?: string;
   name?: string;
   role?: string;            // 'client' | 'admin' | 'node_provider'
   firstSeen: Date;
  lastSeen: Date;
  totalSessions: number;
  totalPageViews: number;
  geo?: any;
  device?: any;
  ipAddress?: string;
  referrer?: string;  // first-ever referrer
  utm?: any;
}

const analyticsUserSchema = new Schema<IAnalyticsUser>({
  userId:             { type: String, required: true, unique: true, index: true },
  registeredUserId:   { type: Schema.Types.ObjectId, ref: 'User', index: true },
  email:              { type: String, index: true },
  name:               String,
  role:               { type: String, index: true },
  firstSeen:          { type: Date, default: Date.now, index: true },
  lastSeen:           { type: Date, default: Date.now, index: true },
  totalSessions:      { type: Number, default: 0 },
  totalPageViews:     { type: Number, default: 0 },
  geo:                geoSchema,
  device:             deviceSchema,
  ipAddress:          String,
  referrer:           String,
  utm:                utmSchema,
}, { timestamps: true });

analyticsUserSchema.index({ 'geo.country': 1 });
analyticsUserSchema.index({ 'geo.city': 1 });
analyticsUserSchema.index({ lastSeen: -1 });

export const AnalyticsUser = mongoose.model<IAnalyticsUser>('AnalyticsUser', analyticsUserSchema);

// ─────────────────────────────────────────────
// AnalyticsSession – one document per browser session
// ─────────────────────────────────────────────
export interface IAnalyticsSession extends Document {
  sessionId: string;
  userId: string;
  startTime: Date;
  lastActive: Date;
  endTime?: Date;
  duration?: number;          // seconds
  pageViews: number;
  entryPage?: string;
  exitPage?: string;
  pagesVisited: {
    page: string;
    timeSpent: number;        // ms
    timestamp: Date;
  }[];
  geo?: any;
  device?: any;
  referrer?: string;
  utm?: any;
  isActive: boolean;
}

const analyticsSessionSchema = new Schema<IAnalyticsSession>({
  sessionId:  { type: String, required: true, unique: true, index: true },
  userId:     { type: String, required: true, index: true },
  startTime:  { type: Date, default: Date.now, index: true },
  lastActive: { type: Date, default: Date.now, index: true },
  endTime:    Date,
  duration:   Number,
  pageViews:  { type: Number, default: 0 },
  entryPage:  String,
  exitPage:   String,
  pagesVisited: [{
    page:      String,
    timeSpent: Number,
    timestamp: Date,
  }],
  geo:        geoSchema,
  device:     deviceSchema,
  referrer:   String,
  utm:        utmSchema,
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

analyticsSessionSchema.index({ userId: 1, startTime: -1 });
analyticsSessionSchema.index({ isActive: 1, startTime: -1 });

export const AnalyticsSession = mongoose.model<IAnalyticsSession>('AnalyticsSession', analyticsSessionSchema);

// ─────────────────────────────────────────────
// AnalyticsEvent – every tracked action
// ─────────────────────────────────────────────
export type EventType =
  | 'PAGE_VIEW'
  | 'PAGE_EXIT'
  | 'TIME_ON_PAGE'
  | 'BUTTON_CLICK'
  | 'LINK_CLICK'
  | 'FORM_SUBMIT'
  | 'SCROLL_DEPTH'
  | 'SESSION_START'
  | 'SESSION_END'
  | 'USER_IDENTIFIED'
  | 'CUSTOM';

export interface IAnalyticsEvent extends Document {
  eventType: EventType;
  userId: string;
  sessionId: string;
  page: string;
  timestamp: Date;
  metadata: Record<string, any>;
  geo?: any;
}

const analyticsEventSchema = new Schema<IAnalyticsEvent>({
  eventType:  { type: String, required: true, index: true },
  userId:     { type: String, required: true, index: true },
  sessionId:  { type: String, required: true, index: true },
  page:       { type: String, required: true, index: true },
  timestamp:  { type: Date, default: Date.now, index: true },
  metadata:   { type: Schema.Types.Mixed, default: {} },
  geo:        geoSchema,
}, { });

analyticsEventSchema.index({ userId: 1, timestamp: -1 });
analyticsEventSchema.index({ sessionId: 1, timestamp: 1 });
analyticsEventSchema.index({ eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ page: 1, timestamp: -1 });
analyticsEventSchema.index({ 'geo.country': 1, timestamp: -1 });
// TTL: auto-delete raw events after 180 days
analyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export const AnalyticsEvent = mongoose.model<IAnalyticsEvent>('AnalyticsEvent', analyticsEventSchema);
