const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["participant", "organizer"],
      required: true,
    },
    otp: { type: String },
    otpExpiry: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  // Do not re-hash existing bcrypt hashes.
  if (/^\$2[aby]\$/.test(this.password)) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (/^\$2[aby]\$/.test(this.password)) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  // One-time migration path for accounts created by the previous plaintext version.
  return candidatePassword === this.password;
};

module.exports = mongoose.model("User", userSchema);
