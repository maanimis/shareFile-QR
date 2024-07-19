import express from "express";
import multer from "multer";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import qrcode from "qrcode-terminal";

// Convert import.meta.url to __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the local IP address
const getLocalIpAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const alias of iface) {
      if (alias.family === "IPv4" && !alias.internal) {
        return alias.address;
      }
    }
  }
  return "127.0.0.1";
};

const localIp = getLocalIpAddress();

// Command-line arguments configuration using yargs
const argv = yargs(hideBin(process.argv))
  .option("r", {
    alias: "root",
    describe: "Root directory path to save/upload files",
    type: "string",
  })
  .option("port", {
    alias: "p",
    describe: "Port number",
    type: "number",
    default: 3000,
  })
  .option("ip_addr", {
    alias: "ip",
    describe: "IP address",
    type: "string",
    default: localIp,
  })
  .option("download", {
    describe: "File to download",
    type: "string",
  })
  .check((argv) => {
    if (!argv.r && !argv.download) {
      throw new Error("One of --download or -r must be provided.");
    }
    return true;
  })
  .help()
  .alias("help", "h").argv;

const app = express();

// Ensure public directory exists
const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Configure multer to save files with their original names
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, argv.root);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

app.use(express.static(publicDir));

// Route to handle file uploads
app.post("/upload", upload.single("file"), (req, res) => {
  console.log("File uploaded:", req.file);
  res.redirect(
    `/views/upload_success.html?name=${req.file.originalname}&size=${req.file.size}`
  );
});

// Route to handle file downloads
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(".", filename); // Ensure the file path is correct

  // Check if the file exists
  if (fs.existsSync(filePath)) {
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        res.status(500).send("Error downloading file.");
      }
    });
  } else {
    res.status(404).send("File not found.");
  }
});

function startServer({ url, text }) {
  app.listen(argv.port, argv.ip_addr, () => {
    qrcode.generate(url, { small: true }, (qr) => {
      console.log(text);
      console.log(qr);
    });
  });
}

if (argv.download) {
  // Handle file download logic
  const filePath = argv.download;

  if (fs.existsSync(filePath)) {
    console.log(`Downloading file: ${filePath}`);
    const downloadUrl = `http://${localIp}:${
      argv.port
    }/download/${path.basename(filePath)}`;
    startServer({
      url: downloadUrl,
      text: `Scan this QR code to download the file: ${downloadUrl}`,
    });
  } else {
    console.error("File not found:", filePath);
  }
} else if (argv.root) {
  const uploadUrl = `http://${argv.ip_addr}:${argv.port}/`;
  startServer({
    url: uploadUrl,
    text: `Scan this QR code to upload a file: ${uploadUrl}`,
  });
} else {
  yargs.showHelp();
}
