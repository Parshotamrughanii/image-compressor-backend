import express from "express";
import multer from "multer";
import { uploadAndCompress, downloadImage } from "../controllers/imageController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.array("images", 100), uploadAndCompress);
router.get("/download/:filename", downloadImage);

export default router;
