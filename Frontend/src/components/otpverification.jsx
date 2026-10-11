import API_BASE_URL from "../api";
import React, { useState } from "react";
import "./login.css";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const OtpVerification = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const email = localStorage.getItem("resetEmail");

  const handleVerify = async () => {
    if (!email || !/^\d{6}$/.test(otp)) {
      alert("Enter a valid 6-digit OTP");
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/verify-otp`, { email, otp });
      localStorage.setItem("resetOtp", otp);
      navigate("/reset");
    } catch (err) {
      alert(err.response?.data?.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setLoading(true);

      await axios.post(`${API_BASE_URL}/forgot-password`, {
        email,
      });

      alert("OTP resent successfully");

    } catch (err) {
      alert(err.response?.data?.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-left">
        <img
          src="https://illustrations.popsy.co/white/work-from-home.svg"
          alt="otp illustration"
          className="login-image"
        />
      </div>

      <div className="login-right">
        <h2>OTP Verification</h2>
        <p className="sub-text">
          We’ve sent a 6-digit OTP to your email.
        </p>

        <input
          type="text"
          placeholder="Enter OTP"
          maxLength="6"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />

        <button className="login-btn-main" onClick={handleVerify} disabled={loading}>
          {loading ? "Verifying..." : "Verify OTP"}
        </button>

        <p className="signup-text">
          Didn’t receive code?{" "}
          <span
            onClick={handleResendOtp}
            style={{ cursor: "pointer", color: "#6c63ff" }}
          >
            {loading ? "Resending..." : "Resend OTP"}
          </span>
        </p>
      </div>
    </div>
  );
};

export default OtpVerification;
