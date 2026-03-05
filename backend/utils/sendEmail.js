// utils/sendEmail.js
// -------------------------------------------------------
// Sends a booking confirmation email using Gmail SMTP.
// Credentials are read from environment variables:
//   EMAIL_USER  →  your Gmail address
//   EMAIL_PASS  →  Gmail App Password (NOT your normal password)
// -------------------------------------------------------

const nodemailer = require("nodemailer");

// Create a reusable transporter (Gmail SMTP)
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Send a booking confirmation email.
 *
 * @param {string} toEmail    - Recipient email address
 * @param {object} details    - Booking details
 * @param {string} details.movieName
 * @param {string} details.theaterName
 * @param {string} details.date
 * @param {string} details.time
 * @param {string[]} details.seats
 * @param {number} details.totalPrice
 */
async function sendBookingEmail(toEmail, details) {
    const { movieName, theaterName, date, time, seats, totalPrice } = details;

    const mailOptions = {
        from: `"Movie Matrix" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: "Movie Ticket Confirmation - Movie Matrix",
        text: `Your ticket for ${movieName} at ${theaterName} on ${date} ${time} is confirmed.\nSeats: ${seats.join(", ")}\nTotal Paid: ₹${totalPrice}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #1a1a2e; color: #fff; padding: 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 22px;">🎬 Movie Matrix</h1>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #f5c518;">Ticket Confirmed!</p>
                </div>
                <div style="padding: 20px;">
                    <h2 style="margin: 0 0 16px 0; color: #1a1a2e;">${movieName}</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                            <td style="padding: 8px 0; color: #888;">Theatre</td>
                            <td style="padding: 8px 0; font-weight: bold;">${theaterName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #888;">Date</td>
                            <td style="padding: 8px 0; font-weight: bold;">${date}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #888;">Time</td>
                            <td style="padding: 8px 0; font-weight: bold;">${time}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #888;">Seats</td>
                            <td style="padding: 8px 0; font-weight: bold;">${seats.join(", ")}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #888;">Total Paid</td>
                            <td style="padding: 8px 0; font-weight: bold; color: #e94560; font-size: 16px;">₹${totalPrice}</td>
                        </tr>
                    </table>
                </div>
                <div style="background-color: #f5f5f5; padding: 12px; text-align: center; font-size: 12px; color: #888;">
                    Thank you for choosing Movie Matrix! Enjoy the show 🍿
                </div>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Confirmation email sent to ${toEmail}`);
}

/**
 * Send a password reset email.
 *
 * @param {string} toEmail   - Recipient email address
 * @param {string} userName  - User's display name
 * @param {string} resetURL  - Full reset URL with token
 */
async function sendPasswordResetEmail(toEmail, userName, resetURL) {
    const mailOptions = {
        from: `"Movie Matrix" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: "Password Reset - Movie Matrix",
        text: `Hi ${userName},\n\nYou requested a password reset. Click the link below to set a new password:\n\n${resetURL}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, please ignore this email.\n\n- Movie Matrix Team`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #1a1a2e; color: #fff; padding: 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 22px;">🎬 Movie Matrix</h1>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #f5c518;">Password Reset</p>
                </div>
                <div style="padding: 24px;">
                    <p style="font-size: 15px; color: #333;">Hi <strong>${userName}</strong>,</p>
                    <p style="font-size: 14px; color: #555; line-height: 1.6;">
                        You requested a password reset for your Movie Matrix account. Click the button below to set a new password:
                    </p>
                    <div style="text-align: center; margin: 24px 0;">
                        <a href="${resetURL}" style="display: inline-block; padding: 12px 32px; background-color: #e94560; color: #fff; text-decoration: none; border-radius: 5px; font-size: 15px; font-weight: 600;">
                            Reset Password
                        </a>
                    </div>
                    <p style="font-size: 13px; color: #888; line-height: 1.5;">
                        This link will expire in <strong>15 minutes</strong>.<br>
                        If you didn't request this, you can safely ignore this email.
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #aaa;">
                        If the button doesn't work, copy and paste this link into your browser:<br>
                        <a href="${resetURL}" style="color: #e94560; word-break: break-all;">${resetURL}</a>
                    </p>
                </div>
                <div style="background-color: #f5f5f5; padding: 12px; text-align: center; font-size: 12px; color: #888;">
                    Movie Matrix &mdash; Your movie booking companion 🍿
                </div>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${toEmail}`);
}

module.exports = sendBookingEmail;
module.exports.sendPasswordResetEmail = sendPasswordResetEmail;
