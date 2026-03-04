require('dotenv').config();
const mongoose = require('mongoose');
const Movie = require('./models/Movie');
const Theater = require('./models/Theater');
const Showtime = require('./models/Showtime');

function generateSeats() {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const seats = [];
    for (const row of rows) {
        for (let num = 1; num <= 10; num++) {
            seats.push({
                seatId: `${row}${num}`,
                row: row,
                number: num,
                isBooked: false
            });
        }
    }
    return seats; // 100 seats
}

async function run() {
    await mongoose.connect(process.env.MONGO_URI);

    const movies = await Movie.find({ nowShowing: true });
    const theaters = await Theater.find({});

    console.log(`Movies: ${movies.length}, Theaters: ${theaters.length}`);

    // Generate dates: today + next 6 days
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
    }

    const times = ['10:00 AM', '01:00 PM', '04:00 PM', '07:00 PM', '10:00 PM'];
    const prices = [150, 180, 200, 250, 300, 350];

    // Check existing showtimes to avoid duplicates
    const existingShowtimes = await Showtime.find({
        date: { $in: dates }
    }).select('movie theater date time');

    const existingSet = new Set(
        existingShowtimes.map(s => `${s.movie}-${s.theater}-${s.date}-${s.time}`)
    );

    let created = 0, skipped = 0;
    const batch = [];

    for (const movie of movies) {
        // Assign 3-5 random theaters per movie
        const shuffled = [...theaters].sort(() => Math.random() - 0.5);
        const movieTheaters = shuffled.slice(0, 3 + Math.floor(Math.random() * 3));

        for (const theater of movieTheaters) {
            // 3 dates per theater
            const movieDates = dates.slice(0, 3 + Math.floor(Math.random() * 4));

            for (const date of movieDates) {
                // 2-3 showtimes per day
                const shuffledTimes = [...times].sort(() => Math.random() - 0.5);
                const dayTimes = shuffledTimes.slice(0, 2 + Math.floor(Math.random() * 2));

                for (const time of dayTimes) {
                    const key = `${movie._id}-${theater._id}-${date}-${time}`;
                    if (existingSet.has(key)) {
                        skipped++;
                        continue;
                    }

                    const price = prices[Math.floor(Math.random() * prices.length)];
                    batch.push({
                        movie: movie._id,
                        theater: theater._id,
                        date,
                        time,
                        price,
                        seats: generateSeats()
                    });
                    created++;
                }
            }
        }
    }

    // Batch insert
    if (batch.length > 0) {
        const CHUNK = 100;
        for (let i = 0; i < batch.length; i += CHUNK) {
            await Showtime.insertMany(batch.slice(i, i + CHUNK));
            console.log(`  Inserted ${Math.min(i + CHUNK, batch.length)} / ${batch.length} showtimes...`);
        }
    }

    console.log(`\nDone! Created: ${created} showtimes, Skipped: ${skipped} (duplicates)`);
    
    // Summary
    const total = await Showtime.countDocuments({ date: { $in: dates } });
    console.log(`Total showtimes for the next 7 days: ${total}`);

    await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
