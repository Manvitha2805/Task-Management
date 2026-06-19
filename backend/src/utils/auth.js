import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';

const JWT_SECRET = process.env.JWT_SECRET || 'taskmanager_super_secret_key_12345!';

export const hashPassword = (password) => bcrypt.hash(password, 10);
export const comparePassword = (password, hash) => bcrypt.compare(password, hash);

export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const generateMFASecret = (email) => {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, 'TaskManagerApp', secret);
  return { secret, otpauth };
};

export const generateQRCode = async (otpauth) => {
  try {
    return await qrcode.toDataURL(otpauth);
  } catch (err) {
    console.error('Failed to generate QR Code:', err);
    throw err;
  }
};

export const verifyMFAToken = (token, secret) => {
  try {
    return authenticator.verify({ token, secret });
  } catch (err) {
    return false;
  }
};
