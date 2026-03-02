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

module.exports = sendBookingEmail;
