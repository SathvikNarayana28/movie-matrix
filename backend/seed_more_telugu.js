require('dotenv').config();
const mongoose = require('mongoose');
const Movie = require('./models/Movie');
const Theater = require('./models/Theater');
const Showtime = require('./models/Showtime');

const TMDB_KEY = 'c92cbe416616dfd4e39c83b46830725e';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

// More Telugu movies currently playing in Hyderabad (March 2026)
const moreTeluguMovies = [
  {
    title: "Daaku Maharaaj",
    genre: ["Action", "Drama"],
    language: "Telugu",
    duration: 158,
    releaseDate: new Date("2026-01-12"),
    rating: 7.6,
    description: "Nandamuri Balakrishna stars as a fearless outlaw in this high-octane action drama. A powerful story of rebellion, justice, and legacy set against a rustic backdrop with stunning action choreography.",
    cast: ["Nandamuri Balakrishna", "Shraddha Srinath", "Bobby Deol", "Pragya Jaiswal"],
    director: "Bobby Kolli",
    nowShowing: true
  },
  {
    title: "Sankranthiki Vasthunnam",
    genre: ["Action", "Comedy", "Romance"],
    language: "Telugu",
    duration: 150,
    releaseDate: new Date("2026-01-14"),
    rating: 8.0,
    description: "Superstar Mahesh Babu delivers a blockbuster performance in this Sankranthi entertainer. A perfect blend of action, comedy, and romance that became one of the biggest hits of the season.",
    cast: ["Mahesh Babu", "Keerthy Suresh", "Anil Ravipudi"],
    director: "Anil Ravipudi",
    nowShowing: true
  },
  {
    title: "Game Changer",
    genre: ["Action", "Political", "Thriller"],
    language: "Telugu",
    duration: 165,
    releaseDate: new Date("2026-01-10"),
    rating: 7.2,
    description: "Ram Charan plays an honest IAS officer who takes on a corrupt political system in this intense political thriller directed by Shankar. Packed with mass action sequences and a powerful social message.",
    cast: ["Ram Charan", "Kiara Advani", "SJ Suryah", "Anjali"],
    director: "Shankar",
    nowShowing: true
  },
  {
    title: "Thandel",
    genre: ["Action", "Drama", "Thriller"],
    language: "Telugu",
    duration: 155,
    releaseDate: new Date("2026-02-07"),
    rating: 7.8,
    description: "Naga Chaitanya stars in this gripping real-life inspired drama about Srikakulam fishermen who accidentally cross into Pakistani waters. A patriotic and emotional survival story that struck a chord with audiences.",
    cast: ["Naga Chaitanya", "Sai Pallavi"],
    director: "Chandoo Mondeti",
    nowShowing: true
  },
  {
    title: "Robinhood",
    genre: ["Action", "Thriller"],
    language: "Telugu",
    duration: 142,
    releaseDate: new Date("2026-02-20"),
    rating: 7.1,
    description: "Nithiin plays a modern-day Robin Hood who steals from the corrupt to help the underprivileged. A stylish action thriller with sharp twists and high-energy sequences.",
    cast: ["Nithiin", "Sreeleela", "Vennela Kishore"],
    director: "Venky Kudumula",
    nowShowing: true
  },
  {
    title: "Kubera",
    genre: ["Crime", "Thriller", "Drama"],
    language: "Telugu",
    duration: 160,
    releaseDate: new Date("2026-03-01"),
    rating: 7.9,
    description: "Dhanush and Nagarjuna come together in this intense crime thriller directed by Sekhar Kammula. A tale of wealth, power, and moral choices that keeps you on edge throughout.",
    cast: ["Dhanush", "Nagarjuna", "Rashmika Mandanna"],
    director: "Sekhar Kammula",
    nowShowing: true
  },
  {
    title: "Hari Hara Veera Mallu: Part 2",
    genre: ["Action", "Historical", "Adventure"],
    language: "Telugu",
    duration: 168,
    releaseDate: new Date("2026-02-14"),
    rating: 7.5,
    description: "Pawan Kalyan stars in this epic historical adventure set in the Mughal era. A swashbuckling tale of a legendary outlaw fighting against oppression with spectacular visuals and action.",
    cast: ["Pawan Kalyan", "Nidhhi Agerwal", "Bobby Deol"],
    director: "Krish Jagarlamudi",
    nowShowing: true
  },
  {
    title: "OG",
    genre: ["Action", "Comedy"],
    language: "Telugu",
    duration: 145,
    releaseDate: new Date("2026-02-28"),
    rating: 7.0,
    description: "Pawan Kalyan delivers a mass entertainer in this action comedy about a retired gangster who is pulled back into the world he left behind. Packed with humor, punch dialogues, and trademark mass moments.",
    cast: ["Pawan Kalyan", "Priyanka Mohan", "Prakash Raj"],
    director: "Sujeeth",
    nowShowing: true
  },
  {
    title: "Coolie",
    genre: ["Action", "Drama"],
    language: "Telugu",
    duration: 163,
    releaseDate: new Date("2026-02-21"),
    rating: 8.1,
    description: "Rajinikanth stars in Lokesh Kanagaraj's cinematic universe entry as a mysterious coolie with a dark past. An action-packed mass entertainer with stylish filmmaking and a gripping narrative. Released in Telugu to massive response in Hyderabad.",
    cast: ["Rajinikanth", "Shruti Haasan", "Nagarjuna", "Upendra"],
    director: "Lokesh Kanagaraj",
    nowShowing: true
  },
  {
    title: "Toxic",
    genre: ["Action", "Thriller"],
    language: "Telugu",
    duration: 155,
    releaseDate: new Date("2026-03-01"),
    rating: 7.3,
    description: "Yash makes his Tollywood debut in this stylish gangster thriller set in the underworld of Goa. A dark, intense film with stunning visuals and powerful performances. Released in Telugu alongside Kannada.",
    cast: ["Yash", "Kiara Advani", "Nayanthara", "Huma Qureshi"],
    director: "Geetu Mohandas",
    nowShowing: true
  },
  {
    title: "Pushpa 2: Reloaded",
    genre: ["Action", "Drama", "Thriller"],
    language: "Telugu",
    duration: 200,
    releaseDate: new Date("2026-01-17"),
    rating: 8.4,
    description: "The re-release of Pushpa 2: The Rule with 20 minutes of additional footage. Allu Arjun returns as Pushpa Raj in this extended cut that adds new scenes and enhances the theatrical experience of the biggest Indian blockbuster.",
    cast: ["Allu Arjun", "Rashmika Mandanna", "Fahadh Faasil"],
    director: "Sukumar",
    nowShowing: true
  },
  {
    title: "Prema Vimanam",
    genre: ["Romance", "Drama", "Comedy"],
    language: "Telugu",
    duration: 135,
    releaseDate: new Date("2026-02-14"),
    rating: 7.2,
    description: "A charming Valentine's Day romance about two strangers who meet on a flight and discover an unexpected connection. A feel-good love story with beautiful music and heartfelt performances.",
    cast: ["Nani", "Mrunal Thakur"],
    director: "Hanu Raghavapudi",
    nowShowing: true
  }
];

// Seat generator matching Showtime model schema
function generateSeats() {
  const rows = ['A','B','C','D','E','F','G','H','I','J'];
  const seats = [];
  for (const row of rows) {
    for (let num = 1; num <= 10; num++) {
      seats.push({ seatId: `${row}${num}`, row, number: num, isBooked: false });
    }
  }
  return seats;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Fetch TMDB posters
    for (let movie of moreTeluguMovies) {
      try {
        const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(movie.title)}&language=en-US&page=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const m = data.results[0];
          if (m.poster_path) {
            movie.posterUrl = `${TMDB_IMG}${m.poster_path}`;
            movie.tmdbId = String(m.id);
          }
          console.log(`  TMDB: "${movie.title}" → ${m.title} (${m.id})`);
        } else {
          console.log(`  No TMDB match: "${movie.title}"`);
          movie.posterUrl = `https://via.placeholder.com/500x750.png?text=${encodeURIComponent(movie.title)}`;
        }
      } catch (err) {
        movie.posterUrl = `https://via.placeholder.com/500x750.png?text=${encodeURIComponent(movie.title)}`;
      }
    }

    // Check for duplicates and skip
    const existingTitles = (await Movie.find({ language: 'Telugu' }).select('title')).map(m => m.title.toLowerCase());
    const newMovies = moreTeluguMovies.filter(m => !existingTitles.includes(m.title.toLowerCase()));
    console.log(`\nSkipping ${moreTeluguMovies.length - newMovies.length} duplicates, adding ${newMovies.length} new Telugu movies`);

    if (newMovies.length === 0) {
      console.log('No new movies to add.');
      await mongoose.disconnect();
      return;
    }

    const inserted = await Movie.insertMany(newMovies);
    console.log(`\nInserted ${inserted.length} Telugu movies:`);
    inserted.forEach(m => console.log(`  ✓ ${m.title} — ${m._id}`));

    // Generate showtimes for new movies
    const theaters = await Theater.find({});
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    const times = ['10:00 AM', '01:00 PM', '04:00 PM', '07:00 PM', '10:00 PM'];
    const prices = [150, 180, 200, 250, 300, 350];

    let batch = [];
    for (const movie of inserted) {
      const shuffled = [...theaters].sort(() => Math.random() - 0.5);
      const movieTheaters = shuffled.slice(0, 4 + Math.floor(Math.random() * 4)); // 4-7 theatres

      for (const theater of movieTheaters) {
        const movieDates = dates.slice(0, 4 + Math.floor(Math.random() * 4));
        for (const date of movieDates) {
          const shuffledTimes = [...times].sort(() => Math.random() - 0.5);
          const dayTimes = shuffledTimes.slice(0, 2 + Math.floor(Math.random() * 2));
          for (const time of dayTimes) {
            batch.push({
              movie: movie._id,
              theater: theater._id,
              date, time,
              price: prices[Math.floor(Math.random() * prices.length)],
              seats: generateSeats()
            });
          }
        }
      }
    }

    // Insert showtimes in chunks
    const CHUNK = 100;
    for (let i = 0; i < batch.length; i += CHUNK) {
      await Showtime.insertMany(batch.slice(i, i + CHUNK));
    }
    console.log(`\nCreated ${batch.length} showtimes for new Telugu movies`);

    const totalTelugu = await Movie.countDocuments({ language: 'Telugu' });
    const totalShowtimes = await Showtime.countDocuments();
    console.log(`\nTotal Telugu movies now: ${totalTelugu}`);
    console.log(`Total showtimes now: ${totalShowtimes}`);

    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
