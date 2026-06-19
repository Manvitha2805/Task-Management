import express from 'express';
import { prisma } from '../utils/db.js';
import { authenticateUser, requireRoles, recordAuditLog } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper: Get today's date string in local YYYY-MM-DD
const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// GET /api/attendance/status - Get current user's today status
router.get('/status', authenticateUser, async (req, res) => {
  const dateStr = getLocalDateString();
  try {
    const attendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId: req.user.id,
          date: dateStr,
        },
      },
      include: {
        sessions: {
          orderBy: { loginTime: 'asc' },
        },
      },
    });

    if (!attendance) {
      return res.json({ punchedIn: false, attendance: null });
    }

    // Check if the last session has no logoutTime (currently punched in)
    const activeSession = attendance.sessions.find(s => !s.logoutTime);
    res.json({
      punchedIn: !!activeSession,
      activeSession: activeSession || null,
      attendance,
    });
  } catch (error) {
    console.error('Failed to get attendance status:', error);
    res.status(500).json({ error: 'Failed to retrieve attendance status.' });
  }
});

// POST /api/attendance/punch - Punch-in or Punch-out toggle
router.post('/punch', authenticateUser, async (req, res) => {
  const dateStr = getLocalDateString();
  const now = new Date();
  const userId = req.user.id;

  try {
    // 1. Get Settings for Work Hours & Grace Period
    const settings = await prisma.settings.findUnique({
      where: { id: 'global' },
    });

    const workStartStr = settings?.workStartTime || '09:00';
    const graceMinutes = settings?.lateGracePeriod || 15;
    const halfDayHours = settings?.halfDayThreshold || 4;

    // Determine target late time limit today
    const [startH, startM] = workStartStr.split(':').map(Number);
    const limitTime = new Date(now);
    limitTime.setHours(startH, startM + graceMinutes, 0, 0);

    // 2. Query today's attendance record
    let attendance = await prisma.attendance.findUnique({
      where: {
        userId_date: { userId, date: dateStr },
      },
      include: { sessions: true },
    });

    if (!attendance) {
      // 3. PUNCH IN: Create record for the day
      // Determine initial status based on punch-in time vs late mark limit
      let initialStatus = 'PRESENT';
      if (now > limitTime) {
        initialStatus = 'LATE';
      }

      // Check if user has an approved leave today to override
      const leaveToday = await prisma.leave.findFirst({
        where: {
          userId,
          startDate: { lte: dateStr },
          endDate: { gte: dateStr },
          status: 'APPROVED',
        },
      });

      if (leaveToday) {
        initialStatus = 'LEAVE';
      }

      attendance = await prisma.attendance.create({
        data: {
          userId,
          date: dateStr,
          firstLogin: now,
          status: initialStatus,
          sessions: {
            create: {
              loginTime: now,
            },
          },
        },
        include: { sessions: true },
      });

      await recordAuditLog(userId, 'PUNCH_IN', `Punched in at ${now.toLocaleTimeString()}`, req);
      return res.json({ message: 'Punched in successfully.', punchedIn: true, attendance });
    }

    // 4. Record exists - check if user is already punched in
    const activeSession = attendance.sessions.find(s => !s.logoutTime);

    if (activeSession) {
      // 5. PUNCH OUT: Close current active session
      const loginTime = new Date(activeSession.loginTime);
      const sessionSecs = Math.floor((now.getTime() - loginTime.getTime()) / 1000);
      const newTotalDuration = attendance.totalDuration + sessionSecs;

      // Update active session and general attendance
      await prisma.attendanceSession.update({
        where: { id: activeSession.id },
        data: { logoutTime: now },
      });

      // Recalculate status (if duration < threshold, status is half day, unless leave/late override rules specify otherwise)
      let finalStatus = attendance.status;
      if (newTotalDuration < halfDayHours * 3600 && finalStatus !== 'LEAVE') {
        finalStatus = 'HALF_DAY';
      } else if (finalStatus === 'HALF_DAY' && newTotalDuration >= halfDayHours * 3600) {
        // Re-evaluate if they were late originally or present
        const firstLoginTime = new Date(attendance.firstLogin);
        const limitForLate = new Date(firstLoginTime);
        limitForLate.setHours(startH, startM + graceMinutes, 0, 0);
        finalStatus = firstLoginTime > limitForLate ? 'LATE' : 'PRESENT';
      }

      const updatedAttendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          lastLogout: now,
          totalDuration: newTotalDuration,
          sessionCount: attendance.sessionCount + 1,
          status: finalStatus,
        },
        include: { sessions: true },
      });

      await recordAuditLog(userId, 'PUNCH_OUT', `Punched out at ${now.toLocaleTimeString()}. Duration added: ${Math.round(sessionSecs / 60)} mins`, req);
      return res.json({ message: 'Punched out successfully.', punchedIn: false, attendance: updatedAttendance });
    } else {
      // 6. PUNCH IN: Create a new session (multi punch-in of the day)
      const updatedAttendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          sessions: {
            create: {
              loginTime: now,
            },
          },
        },
        include: { sessions: true },
      });

      await recordAuditLog(userId, 'PUNCH_IN_AGAIN', `Punched in again at ${now.toLocaleTimeString()}`, req);
      return res.json({ message: 'Punched in successfully.', punchedIn: true, attendance: updatedAttendance });
    }
  } catch (error) {
    console.error('Punch action failed:', error);
    res.status(500).json({ error: 'Failed to process punch operation.' });
  }
});

// GET /api/attendance/history - Get current user's monthly attendance history
router.get('/history', authenticateUser, async (req, res) => {
  try {
    const history = await prisma.attendance.findMany({
      where: { userId: req.user.id },
      include: { sessions: true },
      orderBy: { date: 'desc' },
    });
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve history.' });
  }
});

// GET /api/attendance/dashboard - Summary stats for admin and manager
router.get('/dashboard', authenticateUser, requireRoles('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  const dateStr = getLocalDateString();
  try {
    // For Managers, filter only their assigned team employees
    let userFilter = {};
    if (req.user.role === 'MANAGER') {
      userFilter = { managerId: req.user.id };
    }

    const totalUsersCount = await prisma.user.count({ where: userFilter });
    
    // Get today's attendance logs
    const attendances = await prisma.attendance.findMany({
      where: {
        date: dateStr,
        user: userFilter,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    const presentCount = attendances.filter(a => a.status === 'PRESENT').length;
    const lateCount = attendances.filter(a => a.status === 'LATE').length;
    const halfDayCount = attendances.filter(a => a.status === 'HALF_DAY').length;
    const leaveCount = attendances.filter(a => a.status === 'LEAVE').length;
    const totalPresent = presentCount + lateCount + halfDayCount;
    const absentCount = totalUsersCount - totalPresent - leaveCount;

    res.json({
      summary: {
        date: dateStr,
        totalEmployees: totalUsersCount,
        present: totalPresent,
        presentNormal: presentCount,
        late: lateCount,
        halfDay: halfDayCount,
        onLeave: leaveCount,
        absent: absentCount < 0 ? 0 : absentCount,
      },
      records: attendances,
    });
  } catch (error) {
    console.error('Failed to get dashboard attendance summary:', error);
    res.status(500).json({ error: 'Failed to retrieve daily attendance summary.' });
  }
});

// GET /api/attendance/employees - Detailed employee logs
router.get('/employees', authenticateUser, requireRoles('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'MANAGER') {
      filter = { managerId: req.user.id };
    }

    const employeeRecords = await prisma.user.findMany({
      where: filter,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        attendances: {
          orderBy: { date: 'desc' },
          take: 30, // Last 30 days
        },
      },
    });

    res.json({ employees: employeeRecords });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve employee records.' });
  }
});

export default router;
