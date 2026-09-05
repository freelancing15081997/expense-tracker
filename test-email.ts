import "dotenv/config";
import nodemailer from "nodemailer";

async function test() {
  console.log("SMTP_PASS:", process.env.SMTP_PASS ? "Set" : "Not Set");
  
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, 
    auth: {
      user: "byjanbooks@gmail.com",
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: '"Test Email" <byjanbooks@gmail.com>',
      to: "byjanbooks@gmail.com", // sending to self for testing
      subject: "Test from AI Studio",
      html: "<b>It works!</b>",
    });
    console.log("Success! Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

test();
