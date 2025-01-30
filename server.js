require("dotenv").config(); // Load environment variables
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const querystring = require("querystring");

const app = express();
app.use(cors()); // Enable frontend-backend communication
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Spotify API Credentials (Hidden on Backend)
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "default_client_id";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "default_client_secret";
const REDIRECT_URI = "https://ycdjun.github.io/SpotifyRecFrontEnd"; // Update this to your frontend deployment URL

// OpenAI API Key (Hidden on Backend)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "default_openai_key";

// 🔹 Step 1: Redirect User to Spotify for Login
app.get("/login", (req, res) => {
    const scope = "user-read-private user-read-email playlist-modify-public playlist-modify-private";
    const authURL = `https://accounts.spotify.com/authorize?${querystring.stringify({
        response_type: "code",
        client_id: SPOTIFY_CLIENT_ID,
        scope: scope,
        redirect_uri: REDIRECT_URI,
    })}`;
    res.redirect(authURL);
});

// 🔹 Step 2: Handle Callback from Spotify (Exchange Code for Access Token)
app.get("/callback", async (req, res) => {
    const code = req.query.code || null;

    if (!code) {
        return res.status(400).json({ error: "Authorization code not found" });
    }

    try {
        const tokenResponse = await axios.post("https://accounts.spotify.com/api/token", querystring.stringify({
            grant_type: "authorization_code",
            code: code,
            redirect_uri: REDIRECT_URI,
            client_id: SPOTIFY_CLIENT_ID,
            client_secret: SPOTIFY_CLIENT_SECRET,
        }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

        res.json(tokenResponse.data); // Return access_token to frontend
    } catch (error) {
        console.error("Error exchanging code for token:", error);
        res.status(500).json({ error: "Failed to retrieve access token" });
    }
});

// 🔹 Step 3: Fetch User's Spotify Profile
app.get("/me", async (req, res) => {
    const accessToken = req.headers.authorization;

    if (!accessToken) {
        console.error("Access token missing in headers:", req.headers);
        return res.status(401).json({ error: "Missing access token" });
    }

    try {
        const userProfile = await axios.get("https://api.spotify.com/v1/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        res.json(userProfile.data);
    } catch (error) {
        console.error("Error fetching user profile:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to fetch user profile" });
    }
});

// 🔹 Spotify Client Credentials Auth (For Public Data Access)
app.get("/spotify-auth", async (req, res) => {
    try {
        const response = await axios.post(
            "https://accounts.spotify.com/api/token",
            new URLSearchParams({ grant_type: "client_credentials" }),
            {
                headers: {
                    Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error("Error during Spotify client credentials auth:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to authenticate with Spotify" });
    }
});

// 🔹 OpenAI Playlist Recommendation Route
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
        console.error("Error generating playlist:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to generate playlist" });
    }
});

// Default route to check if server is running
app.get("/", (req, res) => {
    res.send("Backend is running! Available routes: /login, /callback, /me, /spotify-auth, /generate-playlist");
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
