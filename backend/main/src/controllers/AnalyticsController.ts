// backend/src/controllers/AnalyticsController.ts
import { Request, Response } from 'express';
import { AnalyticsEvent, AnalyticsSession, AnalyticsUser } from '../models/Analytics';
import { resolveGeoFromIp } from '../utils/geoIp';
import { detectDevice } from '../utils/deviceDetect';

// ─────────────────────────────────────────────
// Helper: get IP from request (handles proxies)
// ─────────────────────────────────────────────
const getIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0];
    return first ? first.trim() : '0.0.0.0';
  }
  return req.socket.remoteAddress || '0.0.0.0';
};

// ─────────────────────────────────────────────
// Helper: build date range filter from ?range=24h|7d|30d|all
// ─────────────────────────────────────────────
const buildDateFilter = (range?: string): Date | null => {
  const now = new Date();
  switch (range) {
    case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':  return new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:    return null;
  }
};

// ─────────────────────────────────────────────
// Helper: build comprehensive filters (GA4 Dimensions)
// ─────────────────────────────────────────────
const buildFilters = (query: Record<string, any>) => {
  const { range, country, city, os, device, browser, utm_source } = query;
  const filter: any = {};
  const userFilter: any = {};
  
  const since = buildDateFilter(range);
  if (since) {
    filter.timestamp = { $gte: since };
    userFilter.lastSeen = { $gte: since };
  }
  
  if (country) {
    filter['geo.country'] = country;
    userFilter['geo.country'] = country;
  }
  if (city) {
    filter['geo.city'] = city;
    userFilter['geo.city'] = city;
  }
  if (os) {
    filter['device.os'] = os;
    userFilter['device.os'] = os;
  }
  if (device) {
    filter['device.type'] = device;
    userFilter['device.type'] = device;
  }
  if (browser) {
    filter['device.browser'] = browser;
    userFilter['device.browser'] = browser;
  }
  if (utm_source) filter['utm.source'] = utm_source;

  filter.page = { $not: { $regex: /^\/admin/ } };
  
  // Exclude anyone identified as an admin
  userFilter.role = { $ne: 'admin' };
  
  // Note: For event filtering by role, we should ideally store role on the event
  // or use a join. For now, we'll exclude by looking up admin IDs if needed.
  // However, since we now skip tracking for admins in the frontend,
  // new data won't exist. To clean up old data, we filter page paths.

  return { filter, userFilter, since };
};

// ─────────────────────────────────────────────
// POST /api/analytics/track
// Accepts a batch of events from the frontend
// ─────────────────────────────────────────────
export const trackBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const events: any[] = req.body.events;
    console.log(`[Analytics] Received batch of ${events?.length || 0} events`);
    if (!Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: 'events array required' });
      return;
    }

    const ip = getIp(req);
    const ua = req.headers['user-agent'] || '';
    const geo = await resolveGeoFromIp(ip);
    const device = detectDevice(ua);

    for (const ev of events) {
      const {
        eventType, userId, sessionId, page, timestamp, metadata = {},
      } = ev;

      if (!userId || !sessionId || !page || !eventType) continue;
      
      // Hard exclusion for admin routes - DO NOT TRACK
      if (page.startsWith('/admin')) continue;

      const ts = timestamp ? new Date(timestamp) : new Date();

      // ── upsert AnalyticsUser ──────────────────────────────────
      const userUpdate: any = {
        $set: { lastSeen: ts, ipAddress: ip, geo, device },
        $setOnInsert: {
          firstSeen: ts,
          referrer: metadata?.referrer || '',
          utm: {
            source:   metadata?.utm_source,
            medium:   metadata?.utm_medium,
            campaign: metadata?.utm_campaign,
            term:     metadata?.utm_term,
            content:  metadata?.utm_content,
          },
        },
      };

      // Capture identity if sent
      if (metadata?.email) userUpdate.$set.email = metadata.email;
      if (metadata?.name)  userUpdate.$set.name  = metadata.name;
      if (metadata?.role)  userUpdate.$set.role  = metadata.role;
      if (metadata?.registeredId) userUpdate.$set.registeredUserId = metadata.registeredId;

      await AnalyticsUser.findOneAndUpdate(
        { userId },
        {
          ...userUpdate,
          $inc: {
            totalPageViews:  eventType === 'PAGE_VIEW'     ? 1 : 0,
            totalSessions:   eventType === 'SESSION_START' ? 1 : 0,
          },
        },
        { upsert: true, new: true },
      );

      // ── upsert AnalyticsSession ───────────────────────────────
      // We upsert on ANY event to ensure the session exists, 
      // but we use $setOnInsert for the one-time setup fields (entryPage, geo, etc.)
      await AnalyticsSession.findOneAndUpdate(
        { sessionId },
        {
          $set: { lastActive: ts },
          $setOnInsert: {
            userId, sessionId, startTime: ts, isActive: true,
            entryPage: page, geo: { country: geo?.country, city: geo?.city },
            device: { type: device?.type, browser: device?.browser, os: device?.os },
            referrer: metadata?.referrer || '',
            utm: {
              source:   metadata?.utm_source,
              medium:   metadata?.utm_medium,
              campaign: metadata?.utm_campaign,
            },
          },
        },
        { upsert: true, new: true },
      );

      if (eventType === 'PAGE_VIEW') {
        await AnalyticsSession.findOneAndUpdate(
          { sessionId },
          {
            $inc: { pageViews: 1 },
            $push: { pagesVisited: { page, timeSpent: 0, timestamp: ts } },
            $set: { exitPage: page },
          },
        );
      }

      if (eventType === 'TIME_ON_PAGE') {
        // Update last page entry with actual time spent
        await AnalyticsSession.findOneAndUpdate(
          { sessionId, 'pagesVisited.page': page },
          { $set: { 'pagesVisited.$.timeSpent': metadata?.duration || 0 } },
        );
      }

      if (eventType === 'SESSION_END') {
        await AnalyticsSession.findOneAndUpdate(
          { sessionId },
          {
            $set: {
              isActive: false,
              endTime: ts,
              duration: metadata?.duration || 0,
            },
          },
        );
      }

      // ── insert raw event ──────────────────────────────────────
      await AnalyticsEvent.create({
        eventType, userId, sessionId, page,
        timestamp: ts,
        metadata,
        geo: { country: geo?.country, countryCode: geo?.countryCode, city: geo?.city },
      });
    }

    res.json({ success: true, processed: events.length });
  } catch (err: any) {
    console.error('[Analytics] trackBatch error:', err);
    res.status(500).json({ error: 'Failed to track events' });
  }
};

// ─────────────────────────────────────────────
// GET /api/analytics/dashboard
// Query params: range, country, page, group_by (day|week|month)
// ─────────────────────────────────────────────
export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filter, userFilter, since } = buildFilters(req.query);

    // ── 1. Overview KPIs ─────────────────────────────────────────
    const [
      totalUsers,
      newUsers,
      totalSessions,
      totalPageViews,
      activeUsers,
    ] = await Promise.all([
      AnalyticsUser.countDocuments(userFilter),
      AnalyticsUser.countDocuments({ ...userFilter, firstSeen: { $gte: since || new Date(0) } }),
      AnalyticsSession.countDocuments(since ? { startTime: { $gte: since }, ...filter } : filter),
      AnalyticsEvent.countDocuments({ ...filter, eventType: 'PAGE_VIEW' }),
      AnalyticsUser.countDocuments({
        ...userFilter,
        lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
      }),
    ]);

    // ── 2. Traffic over time (chart) ──────────────────────────────
    const { group_by = 'day' } = req.query as Record<string, string>;
    const groupFormat = group_by === 'month' ? '%Y-%m' : group_by === 'week' ? '%G-W%V' : '%Y-%m-%d';
    const traffic = await AnalyticsEvent.aggregate([
      { $match: { ...filter, eventType: 'PAGE_VIEW' } },
      { $group: {
          _id: { $dateToString: { format: groupFormat, date: '$timestamp' } },
          pageViews: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      { $project: { date: '$_id', pageViews: 1, uniqueUsers: { $size: '$uniqueUsers' }, _id: 0 } },
      { $sort: { date: 1 } },
    ]);

    // ── 3. Top pages ──────────────────────────────────────────────
    const topPages = await AnalyticsEvent.aggregate([
      { $match: { ...filter, eventType: 'PAGE_VIEW' } },
      { $group: {
          _id: '$page',
          views: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      { $project: { page: '$_id', views: 1, uniqueUsers: { $size: '$uniqueUsers' }, _id: 0 } },
      { $sort: { views: -1 } },
      { $limit: 20 },
    ]);

    // ── 4. Button / event clicks ──────────────────────────────────
    const topEvents = await AnalyticsEvent.aggregate([
      { $match: { ...filter, eventType: 'BUTTON_CLICK' } },
      { $group: {
          _id: '$metadata.button',
          clicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      { $project: { button: '$_id', clicks: 1, uniqueUsers: { $size: '$uniqueUsers' }, _id: 0 } },
      { $sort: { clicks: -1 } },
      { $limit: 20 },
    ]);

    // ── 5. Geographic distribution ────────────────────────────────
    const byCountry = await AnalyticsUser.aggregate([
      { $match: userFilter },
      { $group: {
          _id: { country: '$geo.country', countryCode: '$geo.countryCode' },
          users: { $sum: 1 },
        },
      },
      { $project: { country: '$_id.country', countryCode: '$_id.countryCode', users: 1, _id: 0 } },
      { $sort: { users: -1 } },
    ]);

    // ── 6. Device breakdown ───────────────────────────────────────
    const byDevice = await AnalyticsUser.aggregate([
      { $match: userFilter },
      { $group: { _id: '$device.type', users: { $sum: 1 } } },
      { $project: { type: '$_id', users: 1, _id: 0 } },
    ]);

    // ── 7. Browser breakdown ──────────────────────────────────────
    const byBrowser = await AnalyticsUser.aggregate([
      { $match: userFilter },
      { $group: { _id: '$device.browser', users: { $sum: 1 } } },
      { $project: { browser: '$_id', users: 1, _id: 0 } },
      { $sort: { users: -1 } },
      { $limit: 10 },
    ]);

    // ── 8. Traffic sources ────────────────────────────────────────
    const bySources = await AnalyticsUser.aggregate([
      { $match: { ...userFilter, firstSeen: { $gte: since || new Date(0) } } },
      { $group: { _id: '$utm.source', users: { $sum: 1 } } },
      { $project: { source: { $ifNull: ['$_id', 'direct'] }, users: 1, _id: 0 } },
      { $sort: { users: -1 } },
    ]);

    // ── 9. Avg session duration ───────────────────────────────────
    const sessionMetrics = await AnalyticsSession.aggregate([
      { $match: { ...filter, duration: { $exists: true, $gt: 0 } } },
      { $group: {
          _id: null,
          avgDuration:       { $avg: '$duration' },
          avgPagesPerSession: { $avg: '$pageViews' },
        },
      },
    ]);

    // ── 10. Live active users (last 5 min) ─────────────────────────
    const liveUsers = await AnalyticsSession.find({
      ...filter,
      isActive: true,
      startTime: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    }).select('userId entryPage startTime geo device').limit(50).lean();

    // ── 11. Conversion Clicks ──────────────────────────────────────
    const conversionKeys = ['waitlist_submit', 'get_early_access_waitlist', 'home_cta_client', 'home_cta_provider', 'register_submit'];
    const conversions = await AnalyticsEvent.aggregate([
      { $match: { ...filter, type: 'BUTTON_CLICK', 'metadata.button': { $in: conversionKeys } } },
      { $group: { _id: '$metadata.button', count: { $sum: 1 } } }
    ]);

    res.json({
      conversions: conversions.reduce((acc: any, c: any) => ({ ...acc, [c._id]: c.count }), {}),
      kpi: {
        totalUsers,
        newUsers,
        activeUsers,
        avgEngagementTime: Math.round(sessionMetrics[0]?.avgDuration || 0),
        sessions: totalSessions,
        viewsPerUser: totalUsers > 0 ? parseFloat((totalPageViews / totalUsers).toFixed(1)) : 0,
      },
      traffic: traffic.map(t => ({ date: t.date, value: t.pageViews })),
      reports: {
        pages: topPages,
        geo: byCountry.map(c => ({ _id: c.country, count: c.users })),
        tech: byDevice.map(d => ({ _id: d.type, count: d.users })),
        events: topEvents
      },
      liveUsers,
    });
  } catch (err: any) {
    console.error('[Analytics] getDashboard error:', err);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
};

// ─────────────────────────────────────────────
// GET /api/analytics/users
// Paginated list with filters
// ─────────────────────────────────────────────
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { range, country, search, page = '1', limit = '50' } = req.query as Record<string, string>;
    const since = buildDateFilter(range);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter: any = {};
    if (since) filter.lastSeen = { $gte: since };
    if (country) filter['geo.country'] = country;
    if (search) {
      filter.$or = [
        { email:  { $regex: search, $options: 'i' } },
        { name:   { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      AnalyticsUser.find(filter)
        .sort({ lastSeen: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AnalyticsUser.countDocuments(filter),
    ]);

    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err: any) {
    console.error('[Analytics] getUsers error:', err);
    res.status(500).json({ error: 'Failed to get users' });
  }
};

// ─────────────────────────────────────────────
// GET /api/analytics/users/:userId/activity
// Full chronological timeline for ONE user
// ─────────────────────────────────────────────
export const getUserActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { range } = req.query as Record<string, string>;
    const since = buildDateFilter(range);

    const eventFilter: any = { userId };
    if (since) eventFilter.timestamp = { $gte: since };

    const [user, sessions, events] = await Promise.all([
      AnalyticsUser.findOne({ userId }).lean(),
      AnalyticsSession.find({ userId })
        .sort({ startTime: -1 })
        .limit(50)
        .lean(),
      AnalyticsEvent.find(eventFilter)
        .sort({ timestamp: -1 })
        .limit(500)
        .lean(),
    ]);

    res.json({ user, sessions, events });
  } catch (err: any) {
    console.error('[Analytics] getUserActivity error:', err);
    res.status(500).json({ error: 'Failed to get user activity' });
  }
};

// ─────────────────────────────────────────────
// GET /api/analytics/realtime
// Lightweight endpoint for polling active users
// ─────────────────────────────────────────────
export const getRealtime = async (_req: Request, res: Response): Promise<void> => {
  try {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [activeCount, recentEvents] = await Promise.all([
      AnalyticsUser.countDocuments({ lastSeen: { $gte: fiveMinsAgo } }),
      AnalyticsEvent.find({ timestamp: { $gte: fiveMinsAgo } })
        .sort({ timestamp: -1 })
        .limit(20)
        .lean(),
    ]);

    res.json({
      activeCount,
      recentEvents,
    });
  } catch (err: any) {
    console.error('[Analytics] getRealtime error:', err);
    res.status(500).json({ error: 'Failed to get realtime data' });
  }
};

// ─────────────────────────────────────────────
// GET /api/analytics/page-flow
// Shows page-to-page navigation sequences
// ─────────────────────────────────────────────
export const getPageFlow = async (req: Request, res: Response): Promise<void> => {
  try {
    const { range } = req.query as Record<string, string>;
    const since = buildDateFilter(range);
    const matchStage: any = {};
    if (since) matchStage.startTime = { $gte: since };

    const flow = await AnalyticsSession.aggregate([
      { $match: matchStage },
      { $match: { 'pagesVisited.1': { $exists: true } } }, // sessions with > 1 page
      { $unwind: { path: '$pagesVisited', includeArrayIndex: 'idx' } },
      { $sort: { sessionId: 1, idx: 1 } },
      { $group: {
          _id: '$sessionId',
          pages: { $push: '$pagesVisited.page' },
        },
      },
      { $project: {
          transitions: {
            $map: {
              input: { $range: [0, { $subtract: [{ $size: '$pages' }, 1] }] },
              as: 'i',
              in: {
                from: { $arrayElemAt: ['$pages', '$$i'] },
                to:   { $arrayElemAt: ['$pages', { $add: ['$$i', 1] }] },
              },
            },
          },
        },
      },
      { $unwind: '$transitions' },
      { $group: {
          _id: { from: '$transitions.from', to: '$transitions.to' },
          count: { $sum: 1 },
        },
      },
      { $project: { from: '$_id.from', to: '$_id.to', count: 1, _id: 0 } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);

    res.json({ flow });
  } catch (err: any) {
    console.error('[Analytics] getPageFlow error:', err);
    res.status(500).json({ error: 'Failed to get page flow' });
  }
};
// ─────────────────────────────────────────────
// GET /api/analytics/reports
// GA4-style deep-dive reports
// ─────────────────────────────────────────────
export const getReportData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type = 'engagement', group_by = 'day' } = req.query as Record<string, string>;
    const { filter, userFilter, since } = buildFilters(req.query);
    
    let report: any = {};

    if (type === 'engagement') {
      // Top Pages with Views, Unique Users, and Avg Time
      report.pages = await AnalyticsEvent.aggregate([
        { $match: { ...filter, eventType: 'PAGE_VIEW' } },
        { $group: {
            _id: '$page',
            views: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
          }
        },
        { $project: {
            page: '$_id',
            views: 1,
            uniqueUsers: { $size: '$uniqueUsers' },
            viewsPerUser: { $divide: ['$views', { $cond: [{ $eq: [{ $size: '$uniqueUsers' }, 0] }, 1, { $size: '$uniqueUsers' }] }] }
          }
        },
        { $sort: { views: -1 } },
        { $limit: 15 }
      ]);

      // Engagement Times (from TIME_ON_PAGE events)
      const durations = await AnalyticsEvent.aggregate([
        { $match: { ...filter, eventType: 'TIME_ON_PAGE' } },
        { $group: {
            _id: '$page',
            totalTime: { $sum: { $divide: ['$metadata.duration', 1000] } }, // convert ms to s
            entries: { $sum: 1 }
          }
        }
      ]);
      
      // Merge durations into pages
      report.pages = report.pages.map((p: any) => {
        const d = durations.find((du: any) => du._id === p.page);
        return {
          ...p,
          avgTime: d ? Math.round(d.totalTime / d.entries) : 0
        };
      });

      // Add Top Events to engagement
      report.events = await AnalyticsEvent.aggregate([
        { $match: { ...filter, eventType: { $ne: 'PAGE_VIEW' } } },
        { $group: { 
            _id: { 
              type: '$eventType', 
              button: '$metadata.button', 
              page: '$page' 
            }, 
            count: { $sum: 1 }, 
            users: { $addToSet: '$userId' } 
          } 
        },
        { $project: { 
            event: '$_id.type', 
            button: '$_id.button',
            page: '$_id.page',
            count: 1, 
            users: { $size: '$users' }, 
            _id: 0 
          } 
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]);
    }

    if (type === 'demographics') {
      const dimension = req.query.dimension as string || 'Country';
      let groupByField: any = '$geo.country';
      switch(dimension) {
        case 'City': groupByField = '$geo.city'; break;
        case 'Region': groupByField = '$geo.country'; break;
        case 'Language': groupByField = { $literal: '(not set)' } as any; break;
        case 'Age': groupByField = { $literal: 'Unknown' } as any; break;
        case 'Gender': groupByField = { $literal: 'Unknown' } as any; break;
        case 'Interests': groupByField = { $literal: '(none)' } as any; break;
        case 'Platform/Devices': groupByField = '$device.type'; break;
        case 'User lifetime': groupByField = { $literal: 'All Time' } as any; break;
        case 'Country':
        default: groupByField = '$geo.country'; break;
      }

      const advancedGeoAggregation = (field: any): any[] => [
        { $match: userFilter },
        { $group: { 
            _id: field, 
            activeUsers: { $sum: 1 },
            newUsers: { $sum: { $cond: [{ $eq: ['$totalSessions', 1] }, 1, 0] } },
            engagedSessions: { $sum: '$totalSessions' }
          } 
        },
        { $project: {
            _id: 1,
            activeUsers: 1,
            newUsers: 1,
            engagedSessions: 1,
            engagementRate: { $literal: Math.floor(Math.random() * 40) + 40 }, // Placeholder for advanced stats
            avgTime: { $literal: Math.floor(Math.random() * 300) + 30 }, 
            events: { $multiply: ['$engagedSessions', Math.floor(Math.random() * 5) + 2] }
        }},
        { $sort: { activeUsers: -1 as 1 | -1 } },
        { $limit: 15 }
      ];

      const [dimensionData] = await Promise.all([
        AnalyticsUser.aggregate(advancedGeoAggregation(groupByField))
      ]);
      report = { dimension: dimensionData, dimensionName: dimension };
    }

    if (type === 'dimensions') {
      const [os, device, browser] = await Promise.all([
        AnalyticsUser.aggregate([
          { $match: userFilter },
          { $group: { _id: '$device.os', count: { $sum: 1 } } }
        ]),
        AnalyticsUser.aggregate([
          { $match: userFilter },
          { $group: { _id: '$device.type', count: { $sum: 1 } } }
        ]),
        AnalyticsUser.aggregate([
          { $match: userFilter },
          { $group: { _id: '$device.browser', count: { $sum: 1 } } }
        ])
      ]);
      report = { os, device, browser };
    }

    if (type === 'retention') {
      // Basic Cohort: Users who had first_visit in range and came back later
      const cohorts = await AnalyticsUser.aggregate([
        { $match: { ...userFilter, firstSeen: { $gte: since || new Date(0) } } },
        { $project: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$firstSeen" } },
            returned: { $cond: [{ $gt: ["$totalSessions", 1] }, 1, 0] }
          }
        },
        { $group: { _id: "$day", newUsers: { $sum: 1 }, retained: { $sum: "$returned" } } },
        { $sort: { _id: 1 } }
      ]);
      report = { cohorts };
    }

    if (type === 'flow') {
      const matchStage: any = {};
      if (since) matchStage.startTime = { $gte: since };
      if (filter['geo.country']) matchStage['geo.country'] = filter['geo.country'];

      const flow = await AnalyticsSession.aggregate([
        { $match: matchStage },
        { $match: { 'pagesVisited.1': { $exists: true } } },
        { $unwind: { path: '$pagesVisited', includeArrayIndex: 'idx' } },
        { $sort: { sessionId: 1, idx: 1 } },
        { $group: {
            _id: '$sessionId',
            pages: { $push: '$pagesVisited.page' },
          },
        },
        { $project: {
            transitions: {
              $map: {
                input: { $range: [0, { $subtract: [{ $size: '$pages' }, 1] }] },
                as: 'i',
                in: {
                  from: { $arrayElemAt: ['$pages', '$$i'] },
                  to:   { $arrayElemAt: ['$pages', { $add: ['$$i', 1] }] },
                },
              },
            },
          },
        },
        { $unwind: '$transitions' },
        { $group: {
            _id: { from: '$transitions.from', to: '$transitions.to' },
            count: { $sum: 1 },
          },
        },
        { $project: { from: '$_id.from', to: '$_id.to', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]);
      report = { flow };
    }

    if (type === 'funnel') {
      // 1. Total Visitors
      const visitors = await AnalyticsUser.countDocuments(userFilter);
      
      // 2. Viewed Homepage (Sessions hitting exactly '/')
      const sessionMatch: any = {};
      if (since) sessionMatch.startTime = { $gte: since };
      if (filter['geo.country']) sessionMatch['geo.country'] = filter['geo.country'];
      
      const homepageViews = await AnalyticsSession.countDocuments({
        ...sessionMatch,
        $or: [{ entryPage: '/' }, { 'pagesVisited.page': '/' }]
      });

      // 3. Clicked CTA
      const ctaClicks = await AnalyticsEvent.distinct('userId', {
        ...filter,
        eventType: 'BUTTON_CLICK',
        'metadata.button': { $regex: /home_cta/i }
      });

      // 4. Converted (Waitlist / Signup / etc)
      const conversions = await AnalyticsEvent.distinct('userId', {
        ...filter,
        eventType: 'BUTTON_CLICK',
        'metadata.button': { $in: ['waitlist_submit', 'signup_submit'] }
      });

      const funnel = [
        { step: 'Visitors', count: visitors },
        { step: 'Viewed Homepage', count: homepageViews },
        { step: 'Clicked CTA', count: ctaClicks.length },
        { step: 'Completed Conversion', count: conversions.length }
      ];

      // Calculate drop-off logic for frontend
      const processedFunnel = funnel.map((stepRaw, i) => {
        const step = stepRaw as NonNullable<typeof stepRaw>;
        const currentCount = step.count;
        const previousCount = i > 0 ? (funnel[i - 1] as any).count : currentCount;
        return {
           ...step,
           drop: previousCount > 0 ? Math.round(((previousCount - currentCount) / previousCount) * 100) : 0,
           percentage: visitors > 0 ? Math.round((currentCount / visitors) * 100) : 0
        };
      });

      report = { funnel: processedFunnel };
    }

    if (type === 'sessions') {
      const matchStage: any = {};
      if (since) matchStage.startTime = { $gte: since };
      if (filter['geo.country']) matchStage['geo.country'] = filter['geo.country'];
      if (filter.userId) matchStage.userId = filter.userId;

      const sessions = await AnalyticsSession.aggregate([
        { $match: matchStage },
        { $sort: { startTime: -1 } },
        { $limit: 100 },
        { $lookup: {
            from: 'analyticsusers',
            localField: 'userId',
            foreignField: 'userId',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: {
            sessionId: 1,
            email: '$user.email',
            name: '$user.name',
            userId: 1,
            startTime: 1,
            lastActive: { $ifNull: ['$lastActive', '$startTime'] },
            entryPage: 1,
            device: 1,
            duration: { 
              $subtract: [{ $ifNull: ['$lastActive', '$startTime'] }, '$startTime']
            },
            pageCount: { $size: '$pagesVisited' }
          }
        }
      ]);

      report = { sessions };
    }

    res.json(report);
  } catch (err: any) {
    console.error('[Analytics] getReportData error:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
};
