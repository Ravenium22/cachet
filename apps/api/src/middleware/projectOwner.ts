import type { Request, Response, NextFunction } from "express";
import { getDb, projects, eq, and, isNull } from "@megaeth-verify/db";
import { AppError } from "./errorHandler.js";

// Inferred row type from Drizzle schema
type ProjectRow = typeof projects.$inferSelect;

// Extend Express Request to include the loaded project
declare global {
  namespace Express {
    interface Request {
      project?: ProjectRow;
    }
  }
}

/**
 * Middleware that loads a project by :id param and verifies the
 * authenticated user is the owner. Sets req.project on success.
 * Must be used AFTER requireAuth.
 */
export async function requireProjectOwner(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const projectId = req.params["id"] as string | undefined;
    if (!projectId) {
      throw new AppError(400, "Project ID is required");
    }

    const db = getDb();
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        isNull(projects.deletedAt),
      ),
    });

    if (!project) {
      throw new AppError(404, "Project not found");
    }

    if (project.ownerDiscordId !== req.user!.sub) {
      throw new AppError(403, "You do not own this project");
    }

    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
}
