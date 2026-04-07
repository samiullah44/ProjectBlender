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

  /**
   * POST /api/admin/update-config
   * 
   * Updates on-chain global configuration using the backend admin wallet.
   */
  public static async updateConfig(req: Request, res: Response) {
    try {
      const { newAdmin, newFeeCollector, platformFeeBps } = req.body;
      console.log("[AdminController] Updating on-chain config via backend...");

      const tx = await solanaService.updateGlobalConfig(
        newAdmin || null,
        newFeeCollector || null,
        platformFeeBps !== undefined ? Number(platformFeeBps) : null
      );

      res.json({
        success: true,
        message: "On-chain configuration updated successfully",
        transaction: tx
      });
    } catch (error: any) {
      console.error("[AdminController] Error in updateConfig:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to update on-chain configuration",
        details: error.message
      });
    }
  }
}
