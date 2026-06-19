import express from 'express';
import { prisma } from '../utils/db.js';
import { authenticateUser, requireRoles, recordAuditLog } from '../middleware/authMiddleware.js';
import { hashPassword } from '../utils/auth.js';

const router = express.Router();

// GET /api/settings - Retrieve global settings config
router.get('/', authenticateUser, async (req, res) => {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'global' },
    });

    if (!settings) {
      // Auto-fallback initialize settings if somehow deleted
      settings = await prisma.settings.create({
        data: {
          id: 'global',
          workStartTime: '09:00',
          workEndTime: '18:00',
          lateGracePeriod: 15,
          halfDayThreshold: 4,
          holidayCalendar: '[]',
          leaveRules: '{}',
          departmentList: '[]',
        },
      });
    }

    res.json({ settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve settings.' });
  }
});

// PUT /api/settings - Modify global settings (Admin only)
router.put('/', authenticateUser, requireRoles('ADMIN'), async (req, res) => {
  const { workStartTime, workEndTime, lateGracePeriod, halfDayThreshold, holidayCalendar, leaveRules, departmentList } = req.body;

  try {
    const updated = await prisma.settings.update({
      where: { id: 'global' },
      data: {
        workStartTime: workStartTime !== undefined ? workStartTime : undefined,
        workEndTime: workEndTime !== undefined ? workEndTime : undefined,
        lateGracePeriod: lateGracePeriod !== undefined ? parseInt(lateGracePeriod) : undefined,
        halfDayThreshold: halfDayThreshold !== undefined ? parseInt(halfDayThreshold) : undefined,
        holidayCalendar: holidayCalendar !== undefined ? JSON.stringify(holidayCalendar) : undefined,
        leaveRules: leaveRules !== undefined ? JSON.stringify(leaveRules) : undefined,
        departmentList: departmentList !== undefined ? JSON.stringify(departmentList) : undefined,
      },
    });

    await recordAuditLog(req.user.id, 'SETTINGS_UPDATE', 'Updated global workspace settings', req);
    res.json({ settings: updated, message: 'Settings updated successfully.' });
  } catch (error) {
    console.error('Settings update failed:', error);
    res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// PUT /api/settings/profile - Update user profile details
router.put('/profile', authenticateUser, async (req, res) => {
  const { name, email, newPassword } = req.body;

  try {
    const updateData = {};
    if (name) updateData.name = name;
    
    if (email) {
      // Check duplicate email
      const exist = await prisma.user.findUnique({ where: { email } });
      if (exist && exist.id !== req.user.id) {
        return res.status(400).json({ error: 'Email address is already in use.' });
      }
      updateData.email = email;
    }

    if (newPassword) {
      updateData.passwordHash = await hashPassword(newPassword);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
    });

    await recordAuditLog(req.user.id, 'PROFILE_UPDATE', 'Updated personal profile info', req);
    
    res.json({
      message: 'Profile updated successfully!',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        mfaEnabled: updatedUser.mfaEnabled,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
