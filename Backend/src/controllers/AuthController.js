const crypto = require("crypto");
const User = require("../models/User");
const sendMail = require("../utils/sendMail");
const jwt = require("jsonwebtoken");

const otpEmailTemplate = (otp) => `
<!DOCTYPE html>
<html>
<body style="font-family:Arial;background:#f4f6f8;padding:20px;">
  <div style="max-width:500px;margin:auto;background:#fff;padding:20px;border-radius:8px;">
    <h2 style="text-align:center;">Password Reset OTP</h2>
    <p style="text-align:center;">Use the code below to reset your password.</p>
    <h1 style="text-align:center;letter-spacing:6px;">${otp}</h1>
    <p style="text-align:center;">Valid for <b>5 minutes</b>.</p>
  </div>
</body>
</html>`;

const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured in Backend/.env");
  }

  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
};

const validRole = (role) => ["participant", "organizer"].includes(role);
const normalizedEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

exports.signup = async (req, res) => {
  try {
    const { name, password, role } = req.body;
    const email = normalizedEmail(req.body.email);

    if (!name?.trim() || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required." });
    }
    if (!validRole(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const user = await User.create({ name: name.trim(), email, password, role });
    const token = generateToken(user);

    return res.status(201).json({
      message: "Signup successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    console.error("Signup error:", error.message);
    return res.status(500).json({ message: "Unable to create account. Check server configuration." });
  }
};

exports.login = async (req, res) => {
  try {
    const { password, role } = req.body;
    const email = normalizedEmail(req.body.email);

    if (!email || !password || !validRole(role)) {
      return res.status(400).json({ message: "Valid email, password, and role are required." });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (user.role !== role) {
      return res.status(403).json({
        message: `This account is registered as ${user.role}. Please select the correct portal.`,
      });
    }

    // Re-hash old plaintext passwords on the first successful login.
    if (!/^\$2[aby]\$/.test(user.password)) {
      user.password = password;
      await user.save();
    }

    const token = generateToken(user);
    return res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Unable to log in. Check server configuration." });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const email = normalizedEmail(req.body.email);
    if (!email) return res.status(400).json({ message: "Email is required." });

    const user = await User.findOne({ email });
    // Avoid exposing whether an email address has an account.
    if (!user) {
      return res.json({ message: "If an account exists, a reset code will be sent." });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    await sendMail(email, "Password Reset OTP", otpEmailTemplate(otp));
    return res.json({ message: "If an account exists, a reset code will be sent." });
  } catch (error) {
    console.error("Forgot password error:", error.message);
    return res.status(500).json({ message: "Could not send reset code. Check email configuration." });
  }
};


exports.verifyOtp = async (req, res) => {
  try {
    const email = normalizedEmail(req.body.email);
    const { otp } = req.body;
    if (!email || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Enter the email and 6-digit code." });
    }

    const user = await User.findOne({ email });
    if (
      !user ||
      user.otp !== otp ||
      !user.otpExpiry ||
      user.otpExpiry.getTime() < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired reset code." });
    }

    return res.json({ message: "OTP verified successfully." });
  } catch (error) {
    console.error("OTP verification error:", error.message);
    return res.status(500).json({ message: "Could not verify reset code." });
  }
};

exports.verifyOtpAndResetPassword = async (req, res) => {
  try {
    const email = normalizedEmail(req.body.email);
    const { otp, newPassword } = req.body;

    if (!email || typeof otp !== "string" || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters." });
    }

    const user = await User.findOne({ email });
    if (!user || !user.otp || user.otp !== otp) {
      return res.status(400).json({ message: "Invalid or expired reset code." });
    }
    if (!user.otpExpiry || user.otpExpiry.getTime() < Date.now()) {
      user.otp = undefined;
      user.otpExpiry = undefined;
      await user.save();
      return res.status(400).json({ message: "Invalid or expired reset code." });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    return res.json({ message: "Password reset successful." });
  } catch (error) {
    console.error("Reset password error:", error.message);
    return res.status(500).json({ message: "Could not reset password." });
  }
};
