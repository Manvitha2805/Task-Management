import express from 'express';
import { prisma } from '../utils/db.js';
import { authenticateUser, requireRoles, recordAuditLog } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper: Get list of date strings (YYYY-MM-DD) between start and end date
const getDatesInRange = (startDateStr, endDateStr) => {
  const dates = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const current = new Date(start);

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

// GET /api/leaves - Retrieve leaves based on user role permissions
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { role, id } = req.user;
    let queryFilter = {};

    if (role === 'ADMIN' || role === 'HR') {
      queryFilter = {};
    } else if (role === 'MANAGER') {
      queryFilter = {
        OR: [
          { userId: id },
          { user: { managerId: id } },
        ],
      };
    } else {
      queryFilter = { userId: id };
    }

    const leaves = await prisma.leave.findMany({
      where: queryFilter,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    res.json({ leaves });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve leave requests.' });
  }
});

// POST /api/leaves - Apply for leave
router.post('/', authenticateUser, async (req, res) => {
  const { startDate, endDate, type, reason } = req.body;

  if (!startDate || !endDate || !type || !reason) {
    return res.status(400).json({ error: 'Start date, end date, leave type, and reason are required.' });
  }

  try {
    const newLeave = await prisma.leave.create({
      data: {
        userId: req.user.id,
        startDate,
        endDate,
        type,
        reason,
        status: 'PENDING',
      },
    });

    // Notify manager
    if (req.user.managerId) {
      await prisma.notification.create({
        data: {
          userId: req.user.managerId,
          title: 'New Leave Request',
          message: `${req.user.name} applied for ${type} leave from ${startDate} to ${endDate}.`,
        },
      });
    }

    await recordAuditLog(req.user.id, 'LEAVE_APPLY', `Applied for ${type} leave: ${startDate} to ${endDate}`, req);
    res.status(201).json({ leave: newLeave });
  } catch (error) {
    console.error('Leave application failed:', error);
    res.status(500).json({ error: 'Failed to submit leave request.' });
  }
});

// PUT /api/leaves/:id/approve - Approve leave request (Manager/HR/Admin)
router.put('/:id/approve', authenticateUser, requireRoles('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  const { id } = req.params;
  const { managerComment } = req.body;

  try {
    const leave = await prisma.leave.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!leave) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    if (leave.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot approve leave. Current status is ${leave.status}.` });
    }

    // Role boundary validation: Managers can only approve their own team members
    if (req.user.role === 'MANAGER' && leave.user.managerId !== req.user.id && leave.userId !== req.user.id) {
      return res.status(403).json({ error: 'You only have approval rights over your direct team members.' });
    }

    // Update leave request status
    const approvedLeave = await prisma.leave.update({
      where: { id },
      data: {
        status: 'APPROVED',
        managerComment: managerComment || null,
        approvedById: req.user.id,
      },
    });

    // Automatically seed "LEAVE" status in attendance records for each day of the leave range
    const dates = getDatesInRange(leave.startDate, leave.endDate);
    for (const dateStr of dates) {
      try {
        await prisma.attendance.upsert({
          where: {
            userId_date: {
              userId: leave.userId,
              date: dateStr,
            },
          },
          update: {
            status: 'LEAVE',
          },
          create: {
            userId: leave.userId,
            date: dateStr,
            firstLogin: new Date(`${dateStr}T09:00:00`),
            lastLogout: new Date(`${dateStr}T18:00:00`),
            totalDuration: 9 * 3600, // standard 9 hours duration
            status: 'LEAVE',
          },
        });
      } catch (upsertError) {
        console.error(`Failed to upsert attendance leave marker for date ${dateStr}:`, upsertError);
      }
    }

    // Notify employee
    await prisma.notification.create({
      data: {
        userId: leave.userId,
        title: 'Leave Request Approved',
        message: `Your leave request from ${leave.startDate} to ${leave.endDate} has been approved by ${req.user.name}.`,
      },
    });

    await recordAuditLog(req.user.id, 'LEAVE_APPROVE', `Approved leave for user ${leave.userId}: ${leave.startDate} to ${leave.endDate}`, req);
    res.json({ leave: approvedLeave });
  } catch (error) {
    console.error('Leave approval error:', error);
    res.status(500).json({ error: 'Failed to approve leave request.' });
  }
});

// PUT /api/leaves/:id/reject - Reject leave request (Manager/HR/Admin)
router.put('/:id/reject', authenticateUser, requireRoles('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  const { id } = req.params;
  const { managerComment } = req.body;

  try {
    const leave = await prisma.leave.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!leave) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    if (leave.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot reject leave. Current status is ${leave.status}.` });
    }

    // Role boundary validation: Managers can only reject their own team members
    if (req.user.role === 'MANAGER' && leave.user.managerId !== req.user.id && leave.userId !== req.user.id) {
      return res.status(403).json({ error: 'You only have rejection rights over your direct team members.' });
    }

    const rejectedLeave = await prisma.leave.update({
      where: { id },
      data: {
        status: 'REJECTED',
        managerComment: managerComment || null,
        approvedById: req.user.id,
      },
    });

    // Notify employee
    await prisma.notification.create({
      data: {
        userId: leave.userId,
        title: 'Leave Request Rejected',
        message: `Your leave request from ${leave.startDate} to ${leave.endDate} has been rejected by ${req.user.name}.`,
      },
    });

    await recordAuditLog(req.user.id, 'LEAVE_REJECT', `Rejected leave for user ${leave.userId}: ${leave.startDate} to ${leave.endDate}`, req);
    res.json({ leave: rejectedLeave });
  } catch (error) {
    console.error('Leave rejection error:', error);
    res.status(500).json({ error: 'Failed to reject leave request.' });
  }
});

// DELETE /api/leaves/:id - Cancel a pending leave request
router.delete('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;

  try {
    const leave = await prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    if (leave.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only cancel your own leave requests.' });
    }

    if (leave.status !== 'PENDING') {
      return res.status(400).json({ error: 'You can only cancel pending leave requests.' });
    }

    await prisma.leave.delete({ where: { id } });
    await recordAuditLog(req.user.id, 'LEAVE_CANCEL', `Cancelled leave request: ${leave.startDate} to ${leave.endDate}`, req);

    res.json({ success: true, message: 'Leave request cancelled successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel leave request.' });
  }
});

export default router;
