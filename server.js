require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/api/token';

// 🔹 Step 1: Redirect user to Spotify login
app.get('/login', (req, res) => {
    const scope = 'user-library-read playlist-modify-public';
    res.redirect(`https://accounts.spotify.com/authorize?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.SPOTIFY_REDIRECT_URI}&scope=${encodeURIComponent(scope)}`);
});

// 🔹 Step 2: Get Access Token
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).json({ error: 'Missing authorization code' });

    try {
        const response = await axios.post(SPOTIFY_AUTH_URL, new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            client_id: process.env.SPOTIFY_CLIENT_ID,
            client_secret: process.env.SPOTIFY_CLIENT_SECRET
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        res.redirect(`https://ycdjun.github.io/SpotifyRecFrontEnd?access_token=${response.data.access_token}`);
    } catch (error) {
        res.status(500).json({ error: 'Failed to exchange authorization code' });
    }
});

// 🔹 Step 3: Fetch 100 Most Recently Liked Songs
app.get('/liked-songs', async (req, res) => {
    const accessToken = req.headers.authorization;
    if (!accessToken) return res.status(401).json({ error: 'Missing access token' });

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/tracks?limit=100', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const tracks = response.data.items.map(item => ({
            name: item.track.name,
            artist: item.track.artists.map(a => a.name).join(', '),
            id: item.track.id
        }));

        res.json(tracks);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch liked songs' });
    }
});

// 🔹 Step 4: Generate AI Playlist using OpenAI
app.post('/generate-playlist', async (req, res) => {
    const { likedSongs, accessToken } = req.body;
    const prompt = `Generate a playlist of 20 songs similar to these: ${likedSongs.map(s => `${s.name} by ${s.artist}`).join(', ')}. Provide only song names and artists.`;

    try {
        const openaiResponse = await fetch('https://api.openai.com/v1/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-4",
                prompt,
                max_tokens: 200
            })
        });

        const data = await openaiResponse.json();
        const generatedSongs = data.choices[0].text.trim().split('\n').map(song => {
            const parts = song.split(' - ');
            return { name: parts[0], artist: parts[1] };
        });

        // Create Spotify Playlist
        const userResponse = await axios.get('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const createPlaylist = await axios.post(`https://api.spotify.com/v1/users/${userResponse.data.id}/playlists`, {
            name: "AI Generated Playlist",
            public: true
        }, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
        });

        const playlistId = createPlaylist.data.id;

        // Add Songs to Playlist
        const trackIds = [];
        for (const song of generatedSongs) {
            const searchResponse = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(song.name + " " + song.artist)}&type=track&limit=1`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (searchResponse.data.tracks.items.length > 0) {
                trackIds.push(searchResponse.data.tracks.items[0].uri);
            }
        }

        await axios.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            uris: trackIds
        }, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
        });

        res.json({ playlistUrl: `https://open.spotify.com/playlist/${playlistId}` });
    } catch (error) {
        res.status(500).json({ error: 'Error generating playlist' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
