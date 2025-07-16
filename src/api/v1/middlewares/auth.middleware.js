const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const User = require("../model/Users");

const isAuthenticated = async (req, res, next) => {
  try {
    const bearerToken = req.headers["authorization"];
    if (!bearerToken || !bearerToken.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const token = bearerToken.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return null;
      return decoded;
    });

    if (!decoded) {
      throw new AppError("Invalid or expired token", 401);
    }

    const user = await User.findById(decoded.id).select("+password");
    if (!user) {
      throw new AppError("User not found. Please login again.", 401);
    }

    if (user.updatedPasswordAfter && user.updatedPasswordAfter(decoded.iat)) {
      return res
        .status(401)
        .json({ success: false, message: "Password recently updated. Please login again." });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication Middleware Error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Authentication failed.",
    });
  }
};

const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action.",
        });
      }
      next();
    } catch (error) {
      console.error("Role Restriction Middleware Error:", error);
      res.status(500).json({
        success: false,
        message: "An error occurred while checking permissions.",
      });
    }
  };
};

const switchRole = async (req, res) => {
  try {
    const { incomingRole } = req.body;

    if (!["Admin", "Client"].includes(incomingRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role.",
      });
    }

    if (req.user.role !== incomingRole) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to switch to this role.",
      });
    }

    const token = jwt.sign(
      { id: req.user._id, role: incomingRole },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({
      success: true,
      message: "Role switched successfully!",
      token,
    });
  } catch (error) {
    console.error("Switch Role Error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while switching roles.",
    });
  }
};

const createJwtToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

module.exports = {
  isAuthenticated,
  restrictTo,
  switchRole,
  createJwtToken,
};
