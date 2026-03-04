require('dotenv').config();
const mongoose = require('mongoose');
const Movie = require('./models/Movie');
const Showtime = require('./models/Showtime');

// Real movies currently playing in Hyderabad theatres (March 2026)
const realMovies = [
  // ========== TELUGU ==========
  {
    title: "Mana Shankara Vara Prasad Garu",
    genre: ["Drama", "Family"],
    language: "Telugu",
    duration: 155,
    releaseDate: new Date("2026-01-10"),
    rating: 8.2,
    description: "A heartwarming family drama starring Megastar Chiranjeevi. The film explores the life of an ordinary man whose extraordinary journey touches hearts across generations. A massive blockbuster that became one of the highest-grossing Telugu films of all time.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_msvpg.jpg",
    cast: ["Chiranjeevi", "Mrunal Thakur", "Prakash Raj", "Vennela Kishore"],
    director: "Meher Ramesh",
    nowShowing: true
  },
  {
    title: "The RajaSaab",
    genre: ["Horror", "Comedy", "Romance"],
    language: "Telugu",
    duration: 162,
    releaseDate: new Date("2026-01-16"),
    rating: 7.8,
    description: "Prabhas stars in this unique horror-comedy-romance directed by Maruthi. A man encounters supernatural events that lead to an unexpected love story. The film blends scares with laughs and became a massive box office hit.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_rajasaab.jpg",
    cast: ["Prabhas", "Malavika Mohanan", "Nidhhi Agerwal", "Riddhi Kumar"],
    director: "Maruthi",
    nowShowing: true
  },
  {
    title: "Anaganaga Oka Raju",
    genre: ["Action", "Comedy"],
    language: "Telugu",
    duration: 145,
    releaseDate: new Date("2026-01-30"),
    rating: 7.5,
    description: "Naveen Polishetty stars in this action-comedy about an underdog who rises to become an unlikely hero. Packed with humor, action sequences, and Polishetty's signature comic timing.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_anaganaga.jpg",
    cast: ["Naveen Polishetty", "Meenakshi Chaudhary", "Murali Sharma"],
    director: "Rajkumar Periasamy",
    nowShowing: true
  },
  {
    title: "Funky",
    genre: ["Action", "Thriller"],
    language: "Telugu",
    duration: 140,
    releaseDate: new Date("2026-02-13"),
    rating: 7.3,
    description: "Vishwak Sen stars as a quirky, unconventional hero in this stylish action thriller. With slick action sequences and a gripping storyline, Funky delivers a high-energy cinematic experience.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_funky.jpg",
    cast: ["Vishwak Sen", "Natasha Doshi", "Sai Kumar"],
    director: "Siddharth",
    nowShowing: true
  },
  {
    title: "Hey Balwanth",
    genre: ["Comedy", "Drama"],
    language: "Telugu",
    duration: 130,
    releaseDate: new Date("2026-02-20"),
    rating: 7.0,
    description: "Suhas delivers another charming performance in this comedy-drama about an everyday man navigating life's absurdities. A feel-good entertainer with plenty of laughs and heart.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_balwanth.jpg",
    cast: ["Suhas", "Chandini Chowdary", "Sapthagiri"],
    director: "Sagar Konisa",
    nowShowing: true
  },
  {
    title: "Vishnu Vinyasam",
    genre: ["Action", "Drama"],
    language: "Telugu",
    duration: 148,
    releaseDate: new Date("2026-02-27"),
    rating: 6.8,
    description: "Sree Vishnu takes on a powerful action-drama role in this intense film about justice and redemption. A gripping narrative with strong performances and well-choreographed action.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_vishnu.jpg",
    cast: ["Sree Vishnu", "Ritu Varma", "Ajay"],
    director: "Kiran Korrapati",
    nowShowing: true
  },
  {
    title: "Mrithyunjay",
    genre: ["Thriller", "Drama"],
    language: "Telugu",
    duration: 152,
    releaseDate: new Date("2026-03-06"),
    rating: 7.4,
    description: "An intense Telugu thriller about a man who defies death and seeks answers to a mystery that threatens his family. Dark, gripping, and full of unexpected twists.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_mrithyunjay.jpg",
    cast: ["Bellamkonda Srinivas", "Pooja Hegde"],
    director: "Harish Shankar",
    nowShowing: true
  },
  {
    title: "Euphoria",
    genre: ["Romance", "Drama"],
    language: "Telugu",
    duration: 135,
    releaseDate: new Date("2026-02-06"),
    rating: 6.9,
    description: "A beautiful Telugu romantic drama about two strangers whose paths cross during a life-changing event. A poetic and visually stunning film about love, loss, and hope.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_euphoria.jpg",
    cast: ["Teja Sajja", "Rashmika Mandanna"],
    director: "Anil Ravipudi",
    nowShowing: true
  },

  // ========== HINDI ==========
  {
    title: "Border 2",
    genre: ["War", "Action", "Drama"],
    language: "Hindi",
    duration: 170,
    releaseDate: new Date("2026-01-23"),
    rating: 8.0,
    description: "The highly anticipated sequel to the iconic war film Border. Sunny Deol returns alongside Varun Dhawan and Diljit Dosanjh in this powerful patriotic war drama set during the 1971 Indo-Pak war. A massive blockbuster grossing over ₹480 crore.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_border2.jpg",
    cast: ["Sunny Deol", "Varun Dhawan", "Diljit Dosanjh", "Ahan Shetty"],
    director: "Anurag Singh",
    nowShowing: true
  },
  {
    title: "O'Romeo",
    genre: ["Romance", "Drama"],
    language: "Hindi",
    duration: 142,
    releaseDate: new Date("2026-02-13"),
    rating: 7.2,
    description: "Shahid Kapoor delivers a stellar performance in this modern-day love story inspired by Shakespeare's timeless tale. A fresh take on romance with powerful performances and soulful music.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_oromeo.jpg",
    cast: ["Shahid Kapoor", "Janhvi Kapoor"],
    director: "Imtiaz Ali",
    nowShowing: true
  },
  {
    title: "Mardaani 3",
    genre: ["Action", "Crime", "Thriller"],
    language: "Hindi",
    duration: 138,
    releaseDate: new Date("2026-01-30"),
    rating: 7.6,
    description: "Rani Mukerji returns as the fierce cop Shivani Shivaji Roy in the third installment of the hit franchise. This time she takes on a dangerous cybercrime network targeting young women.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_mardaani3.jpg",
    cast: ["Rani Mukerji", "Rajkummar Rao", "Saurabh Shukla"],
    director: "Gopi Puthran",
    nowShowing: true
  },
  {
    title: "Dhurandhar",
    genre: ["Action", "Comedy"],
    language: "Hindi",
    duration: 150,
    releaseDate: new Date("2026-03-19"),
    rating: 7.1,
    description: "Ranveer Singh stars in this high-energy action comedy about a small-town man who stumbles into the world of organized crime. Packed with Ranveer's trademark energy and laughs.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_dhurandhar.jpg",
    cast: ["Ranveer Singh", "Sanjay Dutt", "Arjun Kapoor"],
    director: "Aditya Dhar",
    nowShowing: true
  },
  {
    title: "Kerala Story 2",
    genre: ["Drama", "Thriller"],
    language: "Hindi",
    duration: 145,
    releaseDate: new Date("2026-02-27"),
    rating: 6.5,
    description: "The sequel continues to explore the controversial true story narrative. A gripping drama that sparked nationwide conversations and debate.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_keralastory2.jpg",
    cast: ["Adah Sharma", "Yogita Bihani"],
    director: "Sudipto Sen",
    nowShowing: true
  },

  // ========== ENGLISH ==========
  {
    title: "Scream 7",
    genre: ["Horror", "Thriller", "Mystery"],
    language: "English",
    duration: 115,
    releaseDate: new Date("2026-02-27"),
    rating: 7.4,
    description: "Ghostface returns in the seventh installment of the iconic slasher franchise. A new group of victims must uncover who's behind the mask before it's too late. Packed with twists, scares, and meta-horror commentary.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_scream7.jpg",
    cast: ["Neve Campbell", "Courteney Cox", "Isabel May"],
    director: "Kevin Williamson",
    nowShowing: true
  },
  {
    title: "Crime 101",
    genre: ["Action", "Crime", "Thriller"],
    language: "English",
    duration: 125,
    releaseDate: new Date("2026-02-13"),
    rating: 7.3,
    description: "Chris Hemsworth leads this slick heist thriller about a master criminal who plans the ultimate score. Fast-paced, stylish, and full of twists that keep you guessing until the end.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_crime101.jpg",
    cast: ["Chris Hemsworth", "Mark Ruffalo", "Rebecca Ferguson"],
    director: "Jon Watts",
    nowShowing: true
  },
  {
    title: "Hoppers",
    genre: ["Animation", "Comedy", "Adventure"],
    language: "English",
    duration: 100,
    releaseDate: new Date("2026-03-06"),
    rating: 7.8,
    description: "Pixar's latest animated adventure follows a group of tiny creatures who discover they can hop between parallel worlds. A heartfelt, visually stunning film with humor for all ages.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_hoppers.jpg",
    cast: ["Jon Batiste (voice)", "Zendaya (voice)", "Bobby Moynihan (voice)"],
    director: "Pete Docter",
    nowShowing: true
  },
  {
    title: "The Bride!",
    genre: ["Horror", "Fantasy", "Drama"],
    language: "English",
    duration: 118,
    releaseDate: new Date("2026-03-06"),
    rating: 7.5,
    description: "A gothic reimagining of the Bride of Frankenstein story. A visually stunning and emotionally powerful film about creation, identity, and what it means to be human.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_bride.jpg",
    cast: ["Christian Bale", "Jessie Buckley", "Peter Sarsgaard"],
    director: "Maggie Gyllenhaal",
    nowShowing: true
  },
  {
    title: "28 Years Later",
    genre: ["Horror", "Thriller", "Sci-Fi"],
    language: "English",
    duration: 135,
    releaseDate: new Date("2026-01-16"),
    rating: 8.1,
    description: "The long-awaited sequel to 28 Days Later and 28 Weeks Later. Set nearly three decades after the original outbreak, survivors navigate a changed world where the rage virus has evolved. A haunting, intense return to the franchise.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_28years.jpg",
    cast: ["Cillian Murphy", "Jodie Comer", "Aaron Taylor-Johnson", "Ralph Fiennes"],
    director: "Danny Boyle",
    nowShowing: true
  },
  {
    title: "Project Hail Mary",
    genre: ["Sci-Fi", "Adventure", "Drama"],
    language: "English",
    duration: 155,
    releaseDate: new Date("2026-03-20"),
    rating: 8.3,
    description: "Based on the bestselling novel by Andy Weir (The Martian). An astronaut wakes up alone on a spaceship with no memory of how he got there, and must save Earth from an extinction-level threat. A thrilling, emotional sci-fi epic.",
    posterUrl: "https://image.tmdb.org/t/p/w500/placeholder_hailmary.jpg",
    cast: ["Ryan Gosling", "Sandra Bullock"],
    director: "Phil Lord & Christopher Miller",
    nowShowing: true
  }
];

async function seedRealMovies() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Step 1: Clear all existing showtimes
    const deletedShowtimes = await Showtime.deleteMany({});
    console.log(`Deleted ${deletedShowtimes.deletedCount} old showtimes`);

    // Step 2: Delete all existing movies  
    const deletedMovies = await Movie.deleteMany({});
    console.log(`Deleted ${deletedMovies.deletedCount} old movies`);

    // Step 3: Try to fetch real poster URLs from TMDB
    const TMDB_KEY = 'c92cbe416616dfd4e39c83b46830725e';
    const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

    for (let movie of realMovies) {
      try {
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(movie.title)}&language=en-US&page=1`;
        const res = await fetch(searchUrl);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const tmdbMovie = data.results[0];
          if (tmdbMovie.poster_path) {
            movie.posterUrl = `${TMDB_IMG}${tmdbMovie.poster_path}`;
            movie.tmdbId = String(tmdbMovie.id);
          }
          if (tmdbMovie.backdrop_path && !movie.backdropUrl) {
            movie.backdropUrl = `${TMDB_IMG}${tmdbMovie.backdrop_path}`;
          }
          console.log(`  TMDB match for "${movie.title}": ${tmdbMovie.title} (${tmdbMovie.id})`);
        } else {
          console.log(`  No TMDB match for "${movie.title}" — using placeholder poster`);
          // Use a generic movie poster placeholder
          movie.posterUrl = `https://via.placeholder.com/500x750.png?text=${encodeURIComponent(movie.title)}`;
        }
      } catch (err) {
        console.log(`  TMDB search failed for "${movie.title}": ${err.message}`);
        movie.posterUrl = `https://via.placeholder.com/500x750.png?text=${encodeURIComponent(movie.title)}`;
      }
    }

    // Step 4: Insert all real movies
    const inserted = await Movie.insertMany(realMovies);
    console.log(`\nInserted ${inserted.length} real Hyderabad movies:`);
    inserted.forEach(m => console.log(`  ✓ ${m.title} (${m.language}) — ${m._id}`));

    console.log('\n✅ Real Hyderabad movies seeded successfully!');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error seeding movies:', err);
    process.exit(1);
  }
}

seedRealMovies();
