import { Request, Response } from 'express';
import { solanaService } from '../services/SolanaService';

export class AdminController {
  /**
   * GET /api/admin/platform-fees
   * 
   * Returns current on-chain balance and wallet info for the platform fee collector.
   */
  public static async getPlatformFees(req: Request, res: Response) {
    try {
      console.log("[AdminController] Fetching platform fee stats...");
      const stats = await solanaService.getPlatformFeeStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error("[AdminController] Error in getPlatformFees:", error.message);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch platform fee statistics",
        details: error.message 
      });
    }
  }
}
