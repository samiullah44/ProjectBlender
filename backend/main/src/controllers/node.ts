import { getWsService } from './node/shared';
import { startOfflineNodeChecker, stopOfflineNodeChecker, checkAndUpdateOfflineNodes, reassignFramesFromOfflineNode } from './node/offline';
import { registerNode, generateToken, registerWithToken, revokeNode, listTokens } from './node/registration';
import { heartbeat } from './node/heartbeat';
import { assignJob, calculateNodePerformance, calculateOptimalFrameAssignment, selectFramesForNode, frameCompleted, reportFrameFailure, getJobDistributionReport } from './node/jobs';
import { getAllNodes, getNode, getNodeStatistics, getNodeHistory } from './node/queries';

export class NodeController {
  private static getWsService = getWsService;

  static startOfflineNodeChecker = startOfflineNodeChecker;
  static stopOfflineNodeChecker = stopOfflineNodeChecker;
  // Make private ones public/static to avoid ts errors if they are needed, or just keep them private
  private static checkAndUpdateOfflineNodes = checkAndUpdateOfflineNodes;
  private static reassignFramesFromOfflineNode = reassignFramesFromOfflineNode;

  static registerNode = registerNode;
  static generateToken = generateToken;
  static registerWithToken = registerWithToken;
  static revokeNode = revokeNode;
  static listTokens = listTokens;

  static heartbeat = heartbeat;

  static assignJob = assignJob;
  private static calculateNodePerformance = calculateNodePerformance;
  private static calculateOptimalFrameAssignment = calculateOptimalFrameAssignment;
  private static selectFramesForNode = selectFramesForNode;
  static frameCompleted = frameCompleted;
  static reportFrameFailure = reportFrameFailure;
  static getJobDistributionReport = getJobDistributionReport;

  static getAllNodes = getAllNodes;
  static getNode = getNode;
  static getNodeHistory = getNodeHistory;
  static getNodeStatistics = getNodeStatistics;
}
