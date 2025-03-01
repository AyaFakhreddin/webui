import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { Readable } from "stream";

// Helper function to convert ReadableStream to Node.js Readable
function toNodeReadable(webStream: ReadableStream): Readable {
  const reader = webStream.getReader();
  return new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null); // Signal end of stream
        } else {
          this.push(value); // Push data chunk
        }
      } catch (err) {
        console.error("Error reading stream:", err);
        this.destroy(err as Error); // Handle errors
      }
    },
  });
}

export const config = {
  api: {
    bodyParser: false, // Disable automatic body parsing for file uploads
  },
};

export async function POST(request: NextRequest) {
  try {
    // Log headers for debugging
    console.log("Request Headers:", JSON.stringify(request.headers));

    // Validate Content-Type header
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.startsWith("multipart/form-data")) {
      console.error("Invalid Content-Type header:", contentType);
      return NextResponse.json(
        { message: "Missing or invalid Content-Type header" },
        { status: 400 }
      );
    }

    const busboy = require("busboy");
    const bb = busboy({ headers: request.headers });

    const uploadsDir = path.join(process.cwd(), "uploads");

    // Ensure the uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      console.log("Creating uploads directory...");
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let fileName = "";

    return new Promise((resolve, reject) => {
      bb.on("file", (_, file, info) => {
        const { filename, mimeType } = info;

        console.log("File Received:", { filename, mimeType }); // Log file details

        // Validate file type (e.g., allow only images)
        if (!["image/jpeg", "image/png"].includes(mimeType)) {
          console.error("Invalid file type:", mimeType);
          return resolve(
            NextResponse.json(
              { message: "Invalid file type. Only JPEG and PNG are allowed." },
              { status: 400 }
            )
          );
        }

        // Sanitize file name to prevent path traversal attacks
        const safeFileName = Date.now() + "_" + filename.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = path.join(uploadsDir, safeFileName);
        fileName = safeFileName;

        console.log("Saving File To:", filePath); // Log file save path

        // Pipe the incoming file stream to the destination file
        file.pipe(fs.createWriteStream(filePath));
      });

      bb.on("finish", () => {
        console.log("Busboy Finished Processing"); // Log when processing is complete
        if (!fileName) {
          console.error("No file uploaded");
          return resolve(
            NextResponse.json(
              { message: "No file uploaded" },
              { status: 400 }
            )
          );
        }

        resolve(
          NextResponse.json(
            { message: "File uploaded successfully", fileName },
            { status: 200 }
          )
        );
      });

      bb.on("error", (err: any) => {
        console.error("Busboy error:", err);
        reject(
          NextResponse.json(
            { message: `Internal server error: ${err.message}` },
            { status: 500 }
          )
        );
      });

      // Convert request.body (ReadableStream) to Node.js Readable
      const nodeReadable = toNodeReadable(request.body);

      // Pipe the Node.js Readable stream to busboy
      nodeReadable.pipe(bb);
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { message: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}