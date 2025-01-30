require("dotenv").config(); // Load environment variables
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors()); // Enable frontend-backend communication
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Spotify API Credentials (Hidden on Backend)
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// OpenAI API Key (Hidden on Backend)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Spotify OAuth Token Route
app.get("/spotify-auth", async (req, res) => {
    try {
        const response = await axios.post(
            "https://accounts.spotify.com/api/token",
            new URLSearchParams({
                grant_type: "client_credentials",
            }),
            {
                headers: {
                    Authorization: `Basic ${Buffer.from(
                        `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
                    ).toString("base64")}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to authenticate with Spotify" });
    }
});

// OpenAI Playlist Recommendation Route
app.post("/generate-playlist", async (req, res) => {
    const { tracks } = req.body;
    const prompt = `Based on these songs: ${tracks.join(", ")}, suggest 5 similar tracks for a new playlist.`;

    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4",
                messages: [{ role: "user", content: prompt }],
            },
            {
                headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            }
        );

        res.json({ recommendations: response.data.choices[0].message.content.split("\n") });
    } catch (error) {
        res.status(500).json({ error: "Failed to generate playlist" });
    }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));