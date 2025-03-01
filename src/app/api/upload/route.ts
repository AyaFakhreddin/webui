import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // Disable automatic body parsing for file uploads
  },
};

export async function POST(request: NextRequest) {
  try {
    const busboy = require("busboy");
    const bb = busboy({ headers: request.headers });
    const uploadsDir = path.join(process.cwd(), "uploads");

    // Ensure the uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let fileName = "";

    bb.on("file", (_, file, info) => {
      const filePath = path.join(uploadsDir, info.filename);
      fileName = info.filename;

      // Pipe the incoming file stream to the destination file
      file.pipe(fs.createWriteStream(filePath));
    });

    bb.on("finish", () => {
      if (!fileName) {
        return NextResponse.json(
          { message: "No file uploaded" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { message: "File uploaded successfully", fileName },
        { status: 200 }
      );
    });

    request.raw?.pipe(bb);
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}