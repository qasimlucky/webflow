const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 50
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    password: {
      type: String,
      minlength: 8,
      select: false
    },
    role: {
      type: String,
      enum: ["Admin", "Client"],
      default: "Client"
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active"
    },
    otp: {
      type: String,
    },
    otpCreatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
