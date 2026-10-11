require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "2mb" }));

const authRoutes = require("./routes/authRoutes");
const hackathonRoutes = require("./routes/HackathonRoutes");
const projectRoutes = require("./routes/ProjectRoutes");
const timelineRoutes = require("./routes/TimeLineRoutes");

app.use("/", authRoutes);
app.use("/api/hackathons", hackathonRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/timeline", timelineRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => res.json({ status: "ok", message: "Backend is running." }));
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8003;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((error) => {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  });
