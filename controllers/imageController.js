import sharp from "sharp";
import fs from "fs-extra";
import path from "path";
import { io } from "../server.js"; // Import Socket.io instance

const compressedDir = "compressed";
fs.ensureDirSync(compressedDir); // Ensure directory exists

// Map to store original filenames
const filenameMap = new Map();

// Upload and compress images
export const uploadAndCompress = async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).send("No images uploaded.");

  req.files.forEach(async (file, index) => {
    try {
      const originalSize = fs.statSync(file.path).size / 1024; // Convert to KB

      // Create a safe filename for storage
      const safeFilename = `compressed_${Date.now()}_${index}${path.extname(file.originalname)}`;
      const outputPath = path.join(compressedDir, safeFilename);
      
      await sharp(file.path)
        .resize(800)
        .webp({ quality: 80 })
        .toFile(outputPath);

      const compressedSize = fs.statSync(outputPath).size / 1024; // Convert to KB
      const compressionPercentage = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

      // Delete original file with retry mechanism
      const deleteFile = (filePath, retries = 3, delay = 500) => {
        try {
          fs.unlinkSync(filePath); // Use synchronous version to ensure completion before proceeding
          console.log(`Deleted original file: ${filePath}`);
        } catch (err) {
          if (err.code === 'EBUSY' && retries > 0) {
            console.log(`File busy, retrying deletion in ${delay}ms: ${filePath}`);
            setTimeout(() => deleteFile(filePath, retries - 1, delay * 2), delay);
          } else if (retries <= 0) {
            console.error(`Failed to delete file after retries: ${filePath}`, err);
          } else {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        }
      };
      
      deleteFile(file.path);
      
      // Store the mapping between safe filename and original filename
      filenameMap.set(safeFilename, file.originalname);
      
      // Set timeout to delete the compressed file after 5 seconds
      setTimeout(() => {
        // Use the same robust deletion function for compressed files
        deleteFile(outputPath);
        
        // Remove from the map after deletion
        filenameMap.delete(safeFilename);
      }, 50000); // 5 seconds

      // Emit a real-time event for each compressed image
      io.emit("imageCompressed", {
        fileName: file.originalname,
        originalSize: `${originalSize.toFixed(2)} KB`,
        compressedSize: `${compressedSize.toFixed(2)} KB`,
        compressionPercentage,
        downloadUrl: `https://image-commpressor-backend-ldetb.ondigitalocean.app/download/${safeFilename}`,
      });

      if (index === req.files.length - 1) {
        io.emit("allImagesCompressed");
      }
    } catch (error) {
      console.error("Error compressing image:", error);
    }
  });

  res.status(200).json({ message: "Compression started" });
};

// Download compressed images
export const downloadImage = (req, res) => {
  const safeFilename = req.params.filename;
  const filePath = path.join(compressedDir, safeFilename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found or has been deleted.");
  }
  
  // Get the original filename from the map, or use the safe filename if not found
  const originalFilename = filenameMap.get(safeFilename) || safeFilename;
  
  // Set the Content-Disposition header with the original filename
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFilename)}"`);
  
  // Send the file
  res.sendFile(path.resolve(filePath));
};
