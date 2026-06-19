import express from 'express';
import { prisma } from '../utils/db.js';
import { authenticateUser, requireRoles, recordAuditLog } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/interns - List intern profiles
router.get('/', authenticateUser, requireRoles('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'MANAGER') {
      filter = { managerId: req.user.id };
    }

    const interns = await prisma.internProfile.findMany({
      where: filter,
      include: {
        user: { select: { id: true, name: true, email: true, department: true } },
        mentor: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({ interns });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve interns.' });
  }
});

// GET /api/interns/:userId - Get specific intern details
router.get('/:userId', authenticateUser, async (req, res) => {
  const { userId } = req.params;

  try {
    const { role, id: currentUserId } = req.user;
    
    // Authorization check
    if (role === 'INTERN' && userId !== currentUserId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const intern = await prisma.internProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, department: true } },
        mentor: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    if (!intern) {
      return res.status(404).json({ error: 'Intern profile not found.' });
    }

    if (role === 'MANAGER' && intern.managerId !== currentUserId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Load intern tasks
    const tasks = await prisma.task.findMany({
      where: { assignedId: userId },
      orderBy: { dueDate: 'asc' },
    });

    res.json({ intern, tasks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve intern details.' });
  }
});

// POST /api/interns - Create new intern profile (HR / ADMIN only)
router.post('/', authenticateUser, requireRoles('ADMIN', 'HR'), async (req, res) => {
  const { email, password, name, departmentId, managerId, mentorId, joiningDate, duration } = req.body;

  if (!email || !password || !name || !joiningDate || !duration) {
    return res.status(400).json({ error: 'Email, password, name, joining date, and duration are required.' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists.' });
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.default.hash(password, 10);

    // Create Intern User
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'INTERN',
        departmentId: departmentId || null,
        managerId: managerId || null,
        mentorId: mentorId || null,
      },
    });

    // Default checklists
    const defaultOnboarding = [
      { task: 'account creation', completed: true, date: new Date().toISOString().split('T')[0] },
      { task: 'orientation completed', completed: false, date: null },
      { task: 'initial task assigned', completed: false, date: null },
      { task: 'mentor assigned', completed: !!mentorId, date: mentorId ? new Date().toISOString().split('T')[0] : null },
      { task: 'documentation completed', completed: false, date: null },
    ];

    const defaultOffboarding = [
      { task: 'exit initiation', completed: false },
      { task: 'project handover', completed: false },
      { task: 'mentor review', completed: false },
      { task: 'final evaluation', completed: false },
      { task: 'certificate approval', completed: false },
      { task: 'account deactivation', completed: false },
    ];

    const profile = await prisma.internProfile.create({
      data: {
        userId: user.id,
        managerId: managerId || null,
        mentorId: mentorId || null,
        joiningDate,
        duration: parseInt(duration),
        onboardingStatus: 'IN_PROGRESS',
        onboardingChecklist: JSON.stringify(defaultOnboarding),
        offboardingStatus: 'PENDING',
        offboardingChecklist: JSON.stringify(defaultOffboarding),
      },
    });

    await recordAuditLog(req.user.id, 'INTERN_CREATE', `Created intern account for ${name}`, req);
    res.status(201).json({ profile, user });
  } catch (error) {
    console.error('Failed to create intern:', error);
    res.status(500).json({ error: 'Failed to onboard intern.' });
  }
});

// PUT /api/interns/:userId/onboarding - Update onboarding checklist checklist progress
router.put('/:userId/onboarding', authenticateUser, requireRoles('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  const { userId } = req.params;
  const { checklist } = req.body; // Expect full checklist array

  if (!checklist || !Array.isArray(checklist)) {
    return res.status(400).json({ error: 'Checklist must be a valid array.' });
  }

  try {
    const profile = await prisma.internProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Intern profile not found.' });
    }

    // Role verification check
    if (req.user.role === 'MANAGER' && profile.managerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Check if all items are completed
    const allCompleted = checklist.every(item => item.completed);
    const onboardingStatus = allCompleted ? 'COMPLETED' : 'IN_PROGRESS';

    const updated = await prisma.internProfile.update({
      where: { userId },
      data: {
        onboardingChecklist: JSON.stringify(checklist),
        onboardingStatus,
        joiningLetterUrl: allCompleted ? `/api/interns/${userId}/joining-letter` : null,
      },
    });

    if (allCompleted && profile.onboardingStatus !== 'COMPLETED') {
      await prisma.notification.create({
        data: {
          userId,
          title: 'Joining Letter Available',
          message: 'Congratulations! Your onboarding checklist is fully complete. You can now view and print your joining letter.',
        },
      });
    }

    await recordAuditLog(req.user.id, 'INTERN_ONBOARD_UPDATE', `Updated onboarding checklist for intern ${profile.user.name}. Status: ${onboardingStatus}`, req);
    res.json({ profile: updated });
  } catch (error) {
    console.error('Failed to update onboarding checklist:', error);
    res.status(500).json({ error: 'Failed to update checklist.' });
  }
});

// PUT /api/interns/:userId/offboarding - Update offboarding checklist progress
router.put('/:userId/offboarding', authenticateUser, requireRoles('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  const { userId } = req.params;
  const { checklist } = req.body;

  if (!checklist || !Array.isArray(checklist)) {
    return res.status(400).json({ error: 'Checklist must be a valid array.' });
  }

  try {
    const profile = await prisma.internProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Intern profile not found.' });
    }

    if (req.user.role === 'MANAGER' && profile.managerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const allCompleted = checklist.every(item => item.completed);
    const offboardingStatus = allCompleted ? 'COMPLETED' : 'IN_REVIEW';

    const updated = await prisma.internProfile.update({
      where: { userId },
      data: {
        offboardingChecklist: JSON.stringify(checklist),
        offboardingStatus,
        completionLetterUrl: allCompleted ? `/api/interns/${userId}/completion-letter` : null,
      },
    });

    if (allCompleted && profile.offboardingStatus !== 'COMPLETED') {
      await prisma.notification.create({
        data: {
          userId,
          title: 'Completion Certificate Unlocked',
          message: 'Your exit offboarding checklist is complete. Your internship completion certificate has been generated.',
        },
      });
    }

    await recordAuditLog(req.user.id, 'INTERN_OFFBOARD_UPDATE', `Updated offboarding checklist for intern ${profile.user.name}. Status: ${offboardingStatus}`, req);
    res.json({ profile: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update offboarding checklist.' });
  }
});

// GET /api/interns/:userId/joining-letter - HTML Printable Joining Letter
router.get('/:userId/joining-letter', authenticateUser, async (req, res) => {
  const { userId } = req.params;

  try {
    const profile = await prisma.internProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { name: true, email: true, department: true } },
        manager: { select: { name: true } },
      },
    });

    if (!profile || profile.onboardingStatus !== 'COMPLETED') {
      return res.status(403).json({ error: 'Joining letter is not unlocked yet. Complete onboarding checklist first.' });
    }

    // Role check: Only employee, manager, HR, or admin can fetch
    if (req.user.role === 'INTERN' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.send(`
      <html>
        <head>
          <title>Letter of Internship - ${profile.user.name}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; padding: 40px; color: #333; max-width: 800px; margin: auto; }
            .header { text-align: center; margin-bottom: 50px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
            .logo { font-size: 28px; font-weight: bold; color: #1e3a8a; }
            .date { text-align: right; margin-bottom: 30px; font-weight: 500; }
            .salutation { margin-bottom: 20px; font-size: 16px; }
            .content { margin-bottom: 30px; text-align: justify; font-size: 15px; }
            .signature { margin-top: 60px; border-top: 1px solid #ddd; padding-top: 20px; max-width: 250px; }
            .printable-only { text-align: center; margin-top: 40px; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print printable-only">
            <button onclick="window.print()" style="padding: 10px 20px; background-color: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">Print Letter</button>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;"/>
          </div>
          
          <div class="header">
            <div class="logo">TASK MANAGER ENTERPRISE</div>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">100 Innovation Way, Silicon Valley, CA 94025</div>
          </div>
          
          <div class="date">Date: ${profile.joiningDate}</div>
          
          <div class="salutation">Dear <strong>${profile.user.name}</strong>,</div>
          
          <div class="content">
            We are pleased to offer you an internship position as an <strong>Intern</strong> in our <strong>${profile.user.department?.name || 'Engineering'} Department</strong> at Task Manager Enterprise. 
            Your internship is scheduled to begin on <strong>${profile.joiningDate}</strong> for a duration of <strong>${profile.duration} months</strong>.
          </div>
          
          <div class="content">
            During this internship, you will report directly to your Manager, <strong>${profile.manager?.name || 'Robert Vance'}</strong>. You will be assigned daily projects, coding sprints, and collaborate within a professional workspace environment to gain valuable industry experience.
          </div>

          <div class="content">
            We are excited to welcome you to our team and look forward to working with you to help you grow your coding and project management skills.
          </div>
          
          <div class="signature">
            <p>Sincerely,</p>
            <p style="font-weight: bold; margin-top: 40px;">HR Department</p>
            <p style="color: #666; font-size: 12px;">Task Manager Enterprise</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate joining letter.' });
  }
});

// GET /api/interns/:userId/completion-letter - HTML Printable Completion Letter
router.get('/:userId/completion-letter', authenticateUser, async (req, res) => {
  const { userId } = req.params;

  try {
    const profile = await prisma.internProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { name: true, email: true, department: true } },
        manager: { select: { name: true } },
      },
    });

    if (!profile || profile.offboardingStatus !== 'COMPLETED') {
      return res.status(403).json({ error: 'Completion certificate is not unlocked yet. Complete offboarding checklist first.' });
    }

    if (req.user.role === 'INTERN' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    res.send(`
      <html>
        <head>
          <title>Certificate of Completion - ${profile.user.name}</title>
          <style>
            body { font-family: 'Georgia', serif; line-height: 1.6; padding: 40px; color: #222; max-width: 850px; margin: auto; }
            .border-frame { border: 15px double #1e3a8a; padding: 40px; text-align: center; background-color: #fbfbf9; }
            .logo { font-size: 20px; font-weight: bold; color: #1e3a8a; letter-spacing: 2px; font-family: sans-serif; }
            .title { font-size: 40px; font-family: 'Times New Roman', Times, serif; color: #1e3a8a; margin: 30px 0; }
            .subtitle { font-size: 18px; font-style: italic; color: #555; margin-bottom: 20px; }
            .recipient { font-size: 28px; font-weight: bold; text-decoration: underline; color: #111; margin: 20px 0; }
            .text { font-size: 16px; margin: 30px auto; max-width: 600px; color: #333; line-height: 1.8; }
            .details { margin: 20px 0; font-weight: bold; font-family: sans-serif; font-size: 14px; }
            .footer-sign { display: flex; justify-content: space-around; margin-top: 60px; font-family: sans-serif; }
            .sign-block { border-top: 1px solid #888; width: 200px; padding-top: 10px; font-size: 14px; }
            .printable-only { text-align: center; margin-top: 20px; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
              .border-frame { border: 15px double #1e3a8a; }
            }
          </style>
        </head>
        <body>
          <div class="no-print printable-only">
            <button onclick="window.print()" style="padding: 10px 20px; background-color: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; font-family: sans-serif; margin-bottom: 20px;">Print Certificate</button>
          </div>
          
          <div class="border-frame">
            <div class="logo">TASK MANAGER ENTERPRISE</div>
            <hr style="width: 100px; border-color: #1e3a8a; margin: 15px auto;"/>
            
            <div class="title">CERTIFICATE OF COMPLETION</div>
            <div class="subtitle">This certificate is proudly presented to</div>
            
            <div class="recipient">${profile.user.name}</div>
            
            <div class="text">
              for successfully completing their professional internship program in the <strong>${profile.user.department?.name || 'Engineering'} Department</strong>. 
              Over the course of <strong>${profile.duration} months</strong>, starting from <strong>${profile.joiningDate}</strong>, they have demonstrated outstanding dedication, technical proficiency, and collaborative skills.
            </div>
            
            <div class="details">
              Date Issued: ${todayStr}
            </div>
            
            <div class="footer-sign">
              <div class="sign-block">
                <strong>${profile.manager?.name || 'Robert Vance'}</strong>
                <div>Supervising Manager</div>
              </div>
              <div class="sign-block">
                <strong>Sarah Smith</strong>
                <div>HR Director</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate completion letter.' });
  }
});

export default router;
