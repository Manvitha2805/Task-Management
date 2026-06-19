import express from 'express';
import { prisma } from '../utils/db.js';
import { authenticateUser, recordAuditLog } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/meetings - Get meetings for current user (hosted or guest)
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const meetings = await prisma.meeting.findMany({
      where: {
        OR: [
          { hostId: userId },
          { guestId: userId },
        ],
      },
      include: {
        host: { select: { id: true, name: true, email: true, role: true } },
        guest: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    res.json({ meetings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve meetings.' });
  }
});

// GET /api/meetings/hosts - List managers, HR, and mentors available for booking
router.get('/hosts', authenticateUser, async (req, res) => {
  try {
    const hosts = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
    });
    res.json({ hosts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve hosts.' });
  }
});

// GET /api/meetings/slots/:hostId/availability - Get host availability for a specific day
router.get('/slots/:hostId/availability', authenticateUser, async (req, res) => {
  const { hostId } = req.params;
  const { date } = req.query; // Format: YYYY-MM-DD

  if (!date) {
    return res.status(400).json({ error: 'Date parameter (YYYY-MM-DD) is required.' });
  }

  try {
    const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
    const workStartTime = settings?.workStartTime || '09:00';
    const workEndTime = settings?.workEndTime || '18:00';

    // Parse work start and end hours
    const [startH, startM] = workStartTime.split(':').map(Number);
    const [endH, endM] = workEndTime.split(':').map(Number);

    // Get all booked meetings for the host on the selected day
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59`);

    const bookings = await prisma.meeting.findMany({
      where: {
        hostId,
        status: 'BOOKED',
        startTime: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Create 1-hour slots from workStartTime to workEndTime
    const slots = [];
    const current = new Date(`${date}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`);
    const endLimit = new Date(`${date}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`);

    while (current < endLimit) {
      const slotStart = new Date(current);
      const slotEnd = new Date(current);
      slotEnd.setHours(slotEnd.getHours() + 1); // 1-hour slots

      // Check if slot overlaps with any booked meeting
      const isBooked = bookings.some(b => {
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return (slotStart < bEnd && slotEnd > bStart);
      });

      slots.push({
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        available: !isBooked,
      });

      current.setHours(current.getHours() + 1);
    }

    res.json({ slots });
  } catch (error) {
    console.error('Failed to get availability slots:', error);
    res.status(500).json({ error: 'Failed to check host availability.' });
  }
});

// POST /api/meetings - Book a meeting slot
router.post('/', authenticateUser, async (req, res) => {
  const { title, description, hostId, startTime, endTime, guestName, guestEmail } = req.body;

  if (!title || !hostId || !startTime || !endTime) {
    return res.status(400).json({ error: 'Title, host ID, start time, and end time are required.' });
  }

  try {
    // Check if the slot is already booked for that host
    const start = new Date(startTime);
    const end = new Date(endTime);

    const overlap = await prisma.meeting.findFirst({
      where: {
        hostId,
        status: 'BOOKED',
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });

    if (overlap) {
      return res.status(400).json({ error: 'This time slot is no longer available.' });
    }

    // Determine guest details. If current user is booking, they are the guest
    let guestId = null;
    let finalGuestName = guestName;
    let finalGuestEmail = guestEmail;

    if (req.user) {
      guestId = req.user.id;
      finalGuestName = req.user.name;
      finalGuestEmail = req.user.email;
    }

    const meeting = await prisma.meeting.create({
      data: {
        title,
        description: description || '',
        hostId,
        guestId,
        guestName: finalGuestName,
        guestEmail: finalGuestEmail,
        startTime: start,
        endTime: end,
        status: 'BOOKED',
      },
    });

    // Notify host
    await prisma.notification.create({
      data: {
        userId: hostId,
        title: 'New Meeting Scheduled',
        message: `Meeting "${title}" has been scheduled with ${finalGuestName} for ${start.toLocaleString()}.`,
      },
    });

    if (guestId) {
      await recordAuditLog(guestId, 'MEETING_BOOK', `Booked meeting "${title}" with host ${hostId}`, req);
    }

    res.status(201).json({ meeting });
  } catch (error) {
    console.error('Failed to book meeting:', error);
    res.status(500).json({ error: 'Failed to schedule meeting.' });
  }
});

// PUT /api/meetings/:id/cancel - Cancel a booked meeting
router.put('/:id/cancel', authenticateUser, async (req, res) => {
  const { id } = req.params;

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    const userId = req.user.id;
    if (meeting.hostId !== userId && meeting.guestId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You are not authorized to cancel this meeting.' });
    }

    const updated = await prisma.meeting.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Notify both parties
    const notifyId = userId === meeting.hostId ? meeting.guestId : meeting.hostId;
    if (notifyId) {
      await prisma.notification.create({
        data: {
          userId: notifyId,
          title: 'Meeting Cancelled',
          message: `Meeting "${meeting.title}" scheduled for ${new Date(meeting.startTime).toLocaleString()} has been cancelled.`,
        },
      });
    }

    await recordAuditLog(userId, 'MEETING_CANCEL', `Cancelled meeting: ${meeting.title}`, req);
    res.json({ meeting: updated, message: 'Meeting cancelled successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel meeting.' });
  }
});

export default router;
