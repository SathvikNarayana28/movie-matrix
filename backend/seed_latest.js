require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Movie = require('./models/Movie');

const KEY = process.env.TMDB_API_KEY;
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';

const GENRE_MAP = {28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',18:'Drama',10751:'Family',14:'Fantasy',36:'History',27:'Horror',10402:'Music',9648:'Mystery',10749:'Romance',878:'Sci-Fi',53:'Thriller',10752:'War',37:'Western'};
const LANG_MAP = {en:'English',hi:'Hindi',te:'Telugu',ta:'Tamil',kn:'Kannada',ml:'Malayalam',mr:'Marathi',bn:'Bengali',pa:'Punjabi',pt:'Portuguese',ja:'Japanese',ko:'Korean'};

async function getDetails(tmdbId) {
    const res = await axios.get(`${BASE}/movie/${tmdbId}?api_key=${KEY}&language=en-US&append_to_response=credits,videos`);
    const d = res.data;
    const cast = (d.credits?.cast || []).slice(0, 5).map(c => c.name);
    const director = (d.credits?.crew || []).find(c => c.job === 'Director')?.name || '';
    const trailer = (d.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer');
    const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '';
    const genre = (d.genres || []).map(g => g.name);
    return { duration: d.runtime || 120, cast, director, trailerUrl, genre };
}

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Fetch now playing in India (2 pages)
    const r1 = await axios.get(`${BASE}/movie/now_playing?api_key=${KEY}&language=en-US&region=IN&page=1`);
    const r2 = await axios.get(`${BASE}/movie/now_playing?api_key=${KEY}&language=en-US&region=IN&page=2`);
    const all = [...r1.data.results, ...r2.data.results];
    
    // Filter for Hyderabad-relevant languages + popular English
    const hyderabadLangs = ['te', 'hi', 'en', 'ta'];
    const relevant = all.filter(m => hyderabadLangs.includes(m.original_language) && m.poster_path);
    
    // Pick top movies sorted by popularity
    const topPicks = relevant
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 20);
    
    let added = 0, skipped = 0;
    for (const m of topPicks) {
        const exists = await Movie.findOne({ tmdbId: String(m.id) });
        if (exists) {
            if (!exists.nowShowing) {
                exists.nowShowing = true;
                await exists.save();
                console.log('  Updated to nowShowing:', exists.title);
            } else {
                console.log('  Already exists:', exists.title);
            }
            skipped++;
            continue;
        }
        
        let details;
        try { details = await getDetails(m.id); } catch(e) { details = { duration: 120, cast: [], director: '', trailerUrl: '', genre: [] }; }
        
        const movie = new Movie({
            tmdbId: String(m.id),
            title: m.title,
            genre: details.genre.length > 0 ? details.genre : (m.genre_ids || []).map(id => GENRE_MAP[id] || 'Other'),
            language: LANG_MAP[m.original_language] || 'Other',
            duration: details.duration,
            releaseDate: m.release_date || '2026-01-01',
            rating: m.vote_average || 0,
            description: m.overview || 'No description available.',
            posterUrl: `${IMG}${m.poster_path}`,
            trailerUrl: details.trailerUrl,
            cast: details.cast,
            director: details.director,
            nowShowing: true
        });
        
        await movie.save();
        added++;
        console.log('  Added:', movie.title, '|', movie.language, '| Rating:', movie.rating);
    }
    
    console.log(`\nDone! Added: ${added}, Skipped: ${skipped}`);
    
    // Mark old movies (pre-2025) as not showing
    const oldResult = await Movie.updateMany(
        { releaseDate: { $lt: new Date('2025-01-01') }, nowShowing: true },
        { nowShowing: false }
    );
    console.log(`Marked ${oldResult.modifiedCount} old movies as not showing`);
    
    // Show final list
    const showing = await Movie.find({ nowShowing: true }).select('title language rating releaseDate');
    console.log(`\nFinal nowShowing movies (${showing.length}):`);
    showing.forEach(m => console.log('  -', m.title, '|', m.language, '| Rating:', m.rating));
    
    await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
