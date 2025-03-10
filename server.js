import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import imageRoutes from "./routes/imageRoutes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for Express and Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust this if you have frontend restrictions
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use("/", imageRoutes);
app.use('/compressed', express.static('compressed'));
app.use("/uploads", express.static("uploads"));

// Routes

// Export Socket.io instance
export { io };

// ✅ Use `server.listen()` instead of `app.listen()`
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
