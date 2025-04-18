import sharp from "sharp"; // For image processing
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
// import { generateThumbnail } from '../utils/generateThumbnail.js';

export const generateThumbnail = async (buffer) => {
  return await sharp(buffer)
    .resize(400, 400) // Adjust size as needed
    .toBuffer();
};

export const createThumbnailAndUpload = async (
  fileContent,
  fieldname,
  folder = "media"
) => {
  const image = sharp(fileContent);
  const metadata = await image.metadata();
  const width = 420;
  const height = Math.round((metadata.height / metadata.width) * width);

  const thumbnailBuffer = await image.resize(width, height).toBuffer();
  const thumbnailUrl = await uploadMedia(
    `thumbnail_${fieldname}`,
    thumbnailBuffer,
    "image/jpeg",
    folder
  );
  return thumbnailUrl;
};

export const uploadMedia = (
  fieldname,
  fileContent,
  mime = "image/jpeg",
  folder = "media"
) => {
  return new Promise((resolve, reject) => {
    try {
      let dir = process.env.DocsDir; // e.g., /var/www/neo/neoapis/uploads
      const docsDir = path.join(dir + `/${folder}`);
      ensureDirExists(docsDir);

      // Get the appropriate file extension based on the mime type
      let extension = "";
      switch (mime) {
        case "image/jpeg":
        case "image/jpg":
          extension = ".jpg";
          break;
        case "image/png":
          extension = ".png";
          break;
        case "image/gif":
          extension = ".gif";
          break;
        default:
          extension = ""; // If you want to handle more types, add cases here
      }

      // Check if the fieldname already has an extension
      const currentDate = new Date().toISOString().slice(0, 10); // Formats as YYYY-MM-DD
      const newUUID = uuidv4();
      if (!path.extname(fieldname)) {
        // Append the extension if it's missing
        fieldname = `${currentDate}_${newUUID}_${fieldname}${extension}`;
      } else {
        fieldname = `${currentDate}_${newUUID}_${fieldname}`;
      }

      const docPath = path.join(docsDir, fieldname);
      fs.writeFileSync(docPath, fileContent);
      let image = `http://185.28.22.219:8006/uploads/${folder}/${fieldname}`;
      console.log("File uploaded is ", image);

      resolve(image);
    } catch (error) {
      reject(error);
    }
  });
};
// DocsDir="/var/www/voiceapp/voiceapis/uploads"
// Define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};
