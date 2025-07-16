const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../model/Users");
const AppError = require("../utils/AppError");
const HttpStatusCodes = require("../enums/httpStatusCode");
const { createJwtToken } = require("../middlewares/auth.middleware");
const { sendEmail, sendForgotPasswordEmail } = require("../utils/email");

class UserService {
  static async createUser(data) {
    const { email, password, fullName, role } = data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError("User already exists", HttpStatusCodes.BAD_REQUEST);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      fullName,
      role: role || "Client"
    });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpCreatedAt = new Date();
    await user.save();

    // Send OTP email
    try {
      await sendEmail({
        email: user.email,
        subject: "Email Verification OTP",
        message: `Your verification OTP is: ${otp}. This OTP will expire in 10 minutes.`
      });
    } catch (error) {
      console.error("Failed to send OTP email:", error);
    }

    // Remove password from response
    user.password = undefined;

    return {
      success: true,
      message: "User created successfully. Please check your email for OTP verification.",
      data: user
    };
  }

  static async verifyUserName(data) {
    const { username } = data;

    if (!username) {
      throw new AppError("Username is required", HttpStatusCodes.BAD_REQUEST);
    }

    // Check if username is available (you can add your own logic here)
    const existingUser = await User.findOne({ email: username });
    
    return {
      success: true,
      available: !existingUser,
      message: existingUser ? "Username already taken" : "Username available"
    };
  }

  static async verifyOtp(data) {
    const { email, otp } = data;

    if (!email || !otp) {
      throw new AppError("Email and OTP are required", HttpStatusCodes.BAD_REQUEST);
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("User not found", HttpStatusCodes.NOT_FOUND);
    }

    // Check if OTP is expired (10 minutes)
    const otpExpiryTime = new Date(user.otpCreatedAt.getTime() + 10 * 60 * 1000);
    if (new Date() > otpExpiryTime) {
      throw new AppError("OTP has expired", HttpStatusCodes.BAD_REQUEST);
    }

    if (user.otp !== otp) {
      throw new AppError("Invalid OTP", HttpStatusCodes.BAD_REQUEST);
    }

    // Clear OTP and mark user as verified
    user.otp = undefined;
    user.otpCreatedAt = undefined;
    user.status = "Active";
    await user.save();

    // Generate JWT token
    const token = createJwtToken(user._id);

    user.password = undefined;

    return {
      success: true,
      message: "Email verified successfully",
      data: {
        user,
        token
      }
    };
  }

  static async resendOtp(data) {
    const { email } = data;

    if (!email) {
      throw new AppError("Email is required", HttpStatusCodes.BAD_REQUEST);
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("User not found", HttpStatusCodes.NOT_FOUND);
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpCreatedAt = new Date();
    await user.save();

    // Send new OTP email
    try {
      await sendEmail({
        email: user.email,
        subject: "Email Verification OTP",
        message: `Your new verification OTP is: ${otp}. This OTP will expire in 10 minutes.`
      });
    } catch (error) {
      console.error("Failed to send OTP email:", error);
      throw new AppError("Failed to send OTP email", HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    return {
      success: true,
      message: "OTP sent successfully"
    };
  }

  static async loginUser(data) {
    const { email, password } = data;

    if (!email || !password) {
      throw new AppError("Email and password are required", HttpStatusCodes.BAD_REQUEST);
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      throw new AppError("Invalid credentials", HttpStatusCodes.UNAUTHORIZED);
    }

    // Check if user is active
    if (user.status !== "Active") {
      throw new AppError("Account is not active", HttpStatusCodes.UNAUTHORIZED);
    }

    // Check password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      throw new AppError("Invalid credentials", HttpStatusCodes.UNAUTHORIZED);
    }

    // Generate JWT token
    const token = createJwtToken(user._id);

    user.password = undefined;

    return {
      success: true,
      message: "Login successful",
      data: {
        user,
        token
      }
    };
  }

  static async socialLogin(data) {
    const { email, fullName, socialProvider } = data;

    if (!email || !fullName || !socialProvider) {
      throw new AppError("Email, fullName, and socialProvider are required", HttpStatusCodes.BAD_REQUEST);
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user for social login
      user = await User.create({
        email,
        fullName,
        role: "Client",
        status: "Active"
      });
    }

    // Generate JWT token
    const token = createJwtToken(user._id);

    user.password = undefined;

    return {
      success: true,
      message: "Social login successful",
      data: {
        user,
        token
      }
    };
  }

  static async getUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", HttpStatusCodes.NOT_FOUND);
    }

    user.password = undefined;

    return {
      success: true,
      data: user
    };
  }

  static async forgotPassword(data) {
    const { email } = data;

    if (!email) {
      throw new AppError("Email is required", HttpStatusCodes.BAD_REQUEST);
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("User not found", HttpStatusCodes.NOT_FOUND);
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store reset token in user document (you might want to add these fields to your User model)
    // For now, we'll use the existing OTP fields
    user.otp = resetToken;
    user.otpCreatedAt = resetTokenExpiry;
    await user.save();

    // Send reset email
    try {
      await sendForgotPasswordEmail({
        email: user.email,
        resetToken,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      });
    } catch (error) {
      console.error("Failed to send reset email:", error);
      throw new AppError("Failed to send reset email", HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    return {
      success: true,
      message: "Password reset email sent successfully"
    };
  }

  static async updatePassword(data) {
    const { token, newPassword } = data;

    if (!token || !newPassword) {
      throw new AppError("Token and new password are required", HttpStatusCodes.BAD_REQUEST);
    }

    const user = await User.findOne({ 
      otp: token,
      otpCreatedAt: { $gt: new Date() }
    });

    if (!user) {
      throw new AppError("Invalid or expired reset token", HttpStatusCodes.BAD_REQUEST);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.otp = undefined;
    user.otpCreatedAt = undefined;
    await user.save();

    return {
      success: true,
      message: "Password updated successfully"
    };
  }
}

module.exports = UserService;
