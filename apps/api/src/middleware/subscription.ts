import type { Request, Response, NextFunction } from "express";
import {
  enforceContractLimit,
  enforceManualReverifyLimit,
  enforceRoleMappingLimit,
} from "../services/subscription.js";

export async function requireContractCapacity(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await enforceContractLimit(req.project!.id);
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireRoleMappingCapacity(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await enforceRoleMappingLimit(req.project!.id);
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireManualReverifyCapacity(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await enforceManualReverifyLimit(req.project!.id);
    next();
  } catch (err) {
    next(err);
  }
}
