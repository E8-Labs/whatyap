import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
// import nodeCron from 'node-cron'

import db from "./src/models/index.js";

import UserRouter from "./src/routes/user.route.js";
import BusinessRouter from "./src/routes/dashboard.route.js";
import ReviewRouter from "./src/routes/review.route.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  if (
    req.path.endsWith(".jpg") ||
    req.path.endsWith(".jpeg") ||
    req.path.endsWith(".png") ||
    req.path.endsWith(".gif")
  ) {
    res.setHeader("Content-Type", "image/jpeg");
  }
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use((req, res, next) => {
  console.log(`${req.method} request for '${req.url}'`);
  next();
});

//http://localhost:3000
app.use(
  cors({
    origin: "http://localhost:3000", //https://voiceai-ruby.vercel.app
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Methods", "GET, POST");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

// https://voiceai-ruby.vercel.app
// app.use(cors({
//   origin: 'https://voiceai-ruby.vercel.app',//
//   methods: ['GET', 'POST'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true
// }));

// app.options('*', (req, res) => {
//   res.header('Access-Control-Allow-Origin', 'https://voiceai-ruby.vercel.app');
//   res.header('Access-Control-Allow-Methods', 'GET, POST');
//   res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//   res.header('Access-Control-Allow-Credentials', 'true');
//   res.sendStatus(200);
// });

db.sequelize.sync({ alter: true });

app.use("/api/user", UserRouter);
app.use("/api/dashboard", BusinessRouter);
app.use("/api/review", ReviewRouter);

const server = app.listen(process.env.Port, () => {
  console.log("Started listening on " + process.env.Port);
});
