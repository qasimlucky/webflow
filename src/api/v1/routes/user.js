const express = require("express");
const UserController = require("../controller/UserController");
const {
  isAuthenticated,
} = require("../middlewares/auth.middleware");

const router = express.Router();

// Authentication routes
router.post("/create", UserController.createUser);
router.post("/verify-username", UserController.verifyUserName);
router.post("/login", UserController.loginUser);
router.post("/social-login", UserController.socialLoginUser);
router.post("/verify-otp", UserController.verifyOtp);
router.post("/resend-otp", UserController.resendOtp);
router.post("/forgot-password", UserController.forgotPassword);
router.post("/update-password", UserController.updatePassword);

// Protected routes
router.get("/user-by-token", isAuthenticated, UserController.getUserByToken);

module.exports = router;
