import express from 'express';
import { prisma } from '../utils/db.js';
import { authenticateUser, requireRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper to escape CSV cell contents
const escapeCSV = (str) => {
  if (str === null || str === undefined) return '';
  const val = String(str).replace(/"/g, '""');
  return val.includes(',') || val.includes('\n') || val.includes('"') ? `"${val}"` : val;
};

// Helper: Convert array of objects to CSV string
const convertToCSV = (headers, rows) => {
  const headerLine = headers.join(',') + '\n';
  const rowLines = rows.map(row => row.map(escapeCSV).join(',')).join('\n');
  return headerLine + rowLines;
};

// GET /api/reports/attendance - Export attendance reports in CSV
router.get('/attendance', authenticateUser, requireRoles('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'MANAGER') {
      filter = { user: { managerId: req.user.id } };
    }

    const records = await prisma.attendance.findMany({
      where: filter,
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
      orderBy: { date: 'desc' },
    });

    const headers = ['Employee Name', 'Email', 'Role', 'Date', 'First Login', 'Last Logout', 'Active Work Duration (Mins)', 'Sessions', 'Status'];
    const rows = records.map(r => [
      r.user.name,
      r.user.email,
      r.user.role,
      r.date,
      r.firstLogin ? new Date(r.firstLogin).toLocaleString() : '',
      r.lastLogout ? new Date(r.lastLogout).toLocaleString() : '',
      Math.round(r.totalDuration / 60),
      r.sessionCount,
      r.status,
    ]);

    const csvData = convertToCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${Date.now()}.csv`);
    res.send(csvData);
  } catch (error) {
    console.error('Failed to export attendance report:', error);
    res.status(500).json({ error: 'Failed to generate attendance report.' });
  }
});

// GET /api/reports/tasks - Export task completion reports
router.get('/tasks', authenticateUser, requireRoles('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'MANAGER') {
      filter = {
        OR: [
          { creatorId: req.user.id },
          { assignedTo: { managerId: req.user.id } },
        ],
      };
    }

    const records = await prisma.task.findMany({
      where: filter,
      include: {
        assignedTo: { select: { name: true, email: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const headers = ['Task Title', 'Description', 'Priority', 'Status', 'Due Date', 'Assigned To', 'Creator', 'Created At'];
    const rows = records.map(r => [
      r.title,
      r.description,
      r.priority,
      r.status,
      new Date(r.dueDate).toLocaleDateString(),
      r.assignedTo ? r.assignedTo.name : 'Unassigned',
      r.createdBy.name,
      new Date(r.createdAt).toLocaleString(),
    ]);

    const csvData = convertToCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=task_report_${Date.now()}.csv`);
    res.send(csvData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate task report.' });
  }
});

// GET /api/reports/leaves - Export leave requests report
router.get('/leaves', authenticateUser, requireRoles('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'MANAGER') {
      filter = { user: { managerId: req.user.id } };
    }

    const records = await prisma.leave.findMany({
      where: filter,
      include: {
        user: { select: { name: true, email: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    const headers = ['Employee Name', 'Email', 'Start Date', 'End Date', 'Leave Type', 'Reason', 'Status', 'Manager Comment', 'Approved/Rejected By'];
    const rows = records.map(r => [
      r.user.name,
      r.user.email,
      r.startDate,
      r.endDate,
      r.type,
      r.reason,
      r.status,
      r.managerComment || '',
      r.approvedBy ? r.approvedBy.name : '',
    ]);

    const csvData = convertToCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=leave_report_${Date.now()}.csv`);
    res.send(csvData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate leave report.' });
  }
});

export default router;
