import express from 'express';
import { prisma } from '../utils/db.js';
import { authenticateUser, requireRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/audit - Fetch searchable audit logs (Admin only)
router.get('/', authenticateUser, requireRoles('ADMIN'), async (req, res) => {
  const { search, action, limit = 50, offset = 0 } = req.query;

  try {
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    // Build filter query
    let whereClause = {};

    if (action) {
      whereClause.action = action;
    }

    if (search) {
      whereClause.OR = [
        { details: { contains: search } },
        { action: { contains: search } },
        { ipAddress: { contains: search } },
        {
          user: {
            name: { contains: search },
          },
        },
        {
          user: {
            email: { contains: search },
          },
        },
      ];
    }

    const totalCount = await prisma.auditLog.count({ where: whereClause });

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: parsedLimit,
      skip: parsedOffset,
    });

    res.json({
      logs,
      pagination: {
        total: totalCount,
        limit: parsedLimit,
        offset: parsedOffset,
      },
    });
  } catch (error) {
    console.error('Audit log fetch failed:', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

export default router;
