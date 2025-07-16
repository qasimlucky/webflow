const UserService = require("../services/user.service");
const catchAsyncHandler = require("../utils/catchAsyncHandler");

class UserController {
  static createUser = catchAsyncHandler(async (req, res) => {
    const result = await UserService.createUser(req.body);
    return res.status(201).json(result);
  });

  static verifyUserName = catchAsyncHandler(async (req, res) => {
    const result = await UserService.verifyUserName(req.body);
    return res.status(200).json(result);
  });

  static verifyOtp = catchAsyncHandler(async (req, res) => {
    const result = await UserService.verifyOtp(req.body);
    return res.status(200).json(result);
  });

  static resendOtp = catchAsyncHandler(async (req, res) => {
    const result = await UserService.resendOtp(req.body);
    return res.status(200).json(result);
  });

  static loginUser = catchAsyncHandler(async (req, res) => {
    const result = await UserService.loginUser(req.body);
    return res.status(200).json(result);
  });

  // Social Login
  static socialLoginUser = catchAsyncHandler(async (req, res) => {
    const result = await UserService.socialLogin(req.body);
    return res.status(200).json(result);
  });

  static getUserByToken = catchAsyncHandler(async (req, res) => {
    const { id } = req.user;
    const result = await UserService.getUser(id);
    return res.status(200).json(result);
  });

  static forgotPassword = catchAsyncHandler(async (req, res) => {
    const result = await UserService.forgotPassword(req.body);
    return res.status(200).json(result);
  });

  static updatePassword = catchAsyncHandler(async (req, res) => {
    const result = await UserService.updatePassword(req.body);
    return res.status(200).json(result);
  });
}

module.exports = UserController;
