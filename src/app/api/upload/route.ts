import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import busboy from "busboy";
import { Readable } from "stream";

// Helper function to convert ReadableStream to Node.js Readable
async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  return Buffer.concat(chunks);
}


function clearDirectory(directory: string): void {
  if (fs.existsSync(directory)) {
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      

      const stat = fs.statSync(filePath);
      
      if (stat.isFile()) {
        // Delete file
        fs.unlinkSync(filePath);
      } else if (stat.isDirectory()) {

        clearDirectory(filePath);
        fs.rmdirSync(filePath);
      }
    }
    
  }
}

export async function POST(request: NextRequest) {
  try {
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (fs.existsSync(uploadsDir)) {
      clearDirectory(uploadsDir);
    } else {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { message: "Missing or invalid Content-Type header" },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const buffer = await streamToBuffer(request.body);

    return new Promise((resolve, reject) => {
      const bb = busboy({ headers });
      let fileName = "";
      
      bb.on("file", (fieldname, file, info) => {
        const { filename, mimeType } = info;
        

        if (!["image/jpeg", "image/png"].includes(mimeType)) {
          return resolve(
            NextResponse.json(
              { message: "Invalid file type. Only JPEG and PNG are allowed." },
              { status: 400 }
            )
          );
        }
        

        const safeFileName = Date.now() + "_" + filename.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = path.join(uploadsDir, safeFileName);
        fileName = safeFileName;
        
        console.log(`Saving new file: ${filePath}`);

        file.pipe(fs.createWriteStream(filePath));
      });
      
      bb.on("finish", () => {
        if (!fileName) {
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
      
      bb.on("error", (err) => {
        console.error("Busboy error:", err);
        reject(
          NextResponse.json(
            { message: `Internal server error: ${err.message}` },
            { status: 500 }
          )
        );
      });
      
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(bb);
    });
  } catch (error: any) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { message: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}