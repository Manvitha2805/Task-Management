import express from 'express';
import { prisma } from '../utils/db.js';
import { comparePassword, hashPassword, generateToken, generateMFASecret, generateQRCode, verifyMFAToken } from '../utils/auth.js';
import { authenticateUser, recordAuditLog } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check if MFA is required
    if (user.mfaEnabled) {
      return res.json({
        mfaRequired: true,
        userId: user.id,
        email: user.email,
      });
    }

    const token = generateToken(user);
    await recordAuditLog(user.id, 'LOGIN', 'User logged in successfully without MFA', req);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// POST /api/auth/login/mfa - Verification step for MFA users
router.post('/login/mfa', async (req, res) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    return res.status(400).json({ error: 'User ID and verification code are required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return res.status(400).json({ error: 'Invalid operation. MFA is not enabled.' });
    }

    const isValid = verifyMFAToken(code, user.mfaSecret);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid verification code.' });
    }

    const token = generateToken(user);
    await recordAuditLog(user.id, 'LOGIN_MFA', 'User logged in successfully with MFA OTP', req);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error) {
    console.error('MFA Login verification error:', error);
    res.status(500).json({ error: 'Internal server error during MFA login.' });
  }
});

// GET /api/auth/me - Get current user profile details
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        department: true,
        manager: { select: { id: true, name: true, email: true } },
        mentor: { select: { id: true, name: true, email: true } },
      },
    });
    
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

// POST /api/auth/mfa/setup - Initiate MFA setup by generating a secret and QR code
router.post('/mfa/setup', authenticateUser, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (user.mfaEnabled) {
      return res.status(400).json({ error: 'MFA is already enabled on this account.' });
    }

    const { secret, otpauth } = generateMFASecret(user.email);
    const qrCodeUrl = await generateQRCode(otpauth);

    // Save temporary secret (we don't enable it yet until they verify it)
    await prisma.user.update({
      where: { id: req.user.id },
      data: { mfaSecret: secret },
    });

    res.json({ secret, qrCodeUrl });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ error: 'Failed to initiate MFA setup.' });
  }
});

// POST /api/auth/mfa/enable - Verify code and enable MFA permanently
router.post('/mfa/enable', authenticateUser, async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Verification code is required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user.mfaSecret) {
      return res.status(400).json({ error: 'Must call MFA setup first.' });
    }

    const isValid = verifyMFAToken(code, user.mfaSecret);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { mfaEnabled: true },
    });

    await recordAuditLog(user.id, 'MFA_ENABLE', 'User enabled Multi-Factor Authentication', req);

    res.json({ success: true, message: 'Multi-Factor Authentication enabled successfully!' });
  } catch (error) {
    console.error('MFA enable error:', error);
    res.status(500).json({ error: 'Failed to enable MFA.' });
  }
});

// POST /api/auth/mfa/disable - Disable MFA
router.post('/mfa/disable', authenticateUser, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required to disable MFA.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    await recordAuditLog(user.id, 'MFA_DISABLE', 'User disabled Multi-Factor Authentication', req);

    res.json({ success: true, message: 'MFA disabled successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disable MFA.' });
  }
});

// POST /api/auth/logout - Record logout audit
router.post('/logout', authenticateUser, async (req, res) => {
  try {
    await recordAuditLog(req.user.id, 'LOGOUT', 'User logged out', req);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed.' });
  }
});

export default router;
