// server.js -- for logging.storing the user data while using artographer

import express from "express";
import cors from "cors";
import dbPromise from "./database.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "500mb" }));
app.use(express.static('public'));

const port = process.env.PORT || 3001;

// Root route: show all users, user_images, pinned_artworks
// Serve the dashboard HTML
// Root route: redirect to dashboard
app.get("/", (req, res) => {
    res.redirect('index.html');
});

// API data endpoint for the dashboard
app.get("/api-data", async (req, res) => {
    try {
        const db = await dbPromise;
        const users = await db.all("SELECT * FROM users");
        const userImages = await db.all("SELECT * FROM user_images");
        const pinnedArtworks = await db.all("SELECT * FROM pinned_artworks");

        res.json({ users, userImages, pinnedArtworks });
    } catch (err) {
        console.error("Error fetching data:", err);
        res.status(500).json({ error: err.message });
    }
});
/**
 * Add user
 */
app.post("/add-user", async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "Missing userId" });
        }

        const db = await dbPromise;
        await db.run(
            `INSERT INTO users (user_id, userImageIds, pinnedArtworkIds) VALUES (?, ?, ?)`,
            [userId, JSON.stringify([]), JSON.stringify([])]
        );

        res.json({ success: true, message: `User ${userId} added.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Add user image (auto-create user if missing)
 */
app.post("/add-user-image", async (req, res) => {
    try {
        const { userId, image } = req.body;
        if (!userId || !image?.userimage_id) {
            return res.status(400).json({ error: "Missing userId or image data" });
        }

        const db = await dbPromise;
        
        // Check if image already exists
        const existingImage = await db.get(`SELECT * FROM user_images WHERE user_id = ? AND userimage_id = ?`, [userId, image.userimage_id]);
        if (existingImage) {
            return res.json({ success: true, message: "User image already exists." });
        }

        let user = await db.get(`SELECT * FROM users WHERE user_id = ?`, [userId]);

        if (!user) {
            await db.run(
                `INSERT INTO users (user_id, userImageIds, pinnedArtworkIds) VALUES (?, ?, ?)`,
                [userId, JSON.stringify([image.userimage_id]), JSON.stringify([])]
            );
        } else {
            const imageIds = JSON.parse(user.userImageIds || "[]");
            if (!imageIds.includes(image.userimage_id)) {
                imageIds.push(image.userimage_id);
                // Update the updatedAt timestamp
                await db.run(`UPDATE users SET userImageIds = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ?`, [
                    JSON.stringify(imageIds),
                    userId,
                ]);
            }
        }

        await db.run(
            `INSERT INTO user_images 
                (userimage_id, user_id, title, imageUrl, worldCoords, regionId, confidence, anchors, dateAdded)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                image.userimage_id,
                userId,
                image.title || "",
                image.imageUrl || "",
                JSON.stringify(image.worldCoords || []),
                image.regionId ?? null,
                image.confidence ?? null,
                JSON.stringify(image.anchors || []),
                image.dateAdded || new Date().toISOString(),
            ]
        );

        res.json({ success: true, message: "User image added." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Add pinned artwork (auto-create user if missing)
 */
app.post("/add-user-pin", async (req, res) => {
    try {
        const { userId, artwork } = req.body;
        if (!userId || !artwork?.entryId) {
            return res.status(400).json({ error: "Missing userId or artwork data" });
        }

        const db = await dbPromise;
        
        // Check if artwork is already pinned
        const existingPin = await db.get(`SELECT * FROM pinned_artworks WHERE user_id = ? AND entryId = ?`, [userId, artwork.entryId]);
        if (existingPin) {
            return res.json({ success: true, message: "Artwork already pinned." });
        }

        let user = await db.get(`SELECT * FROM users WHERE user_id = ?`, [userId]);

        if (!user) {
            await db.run(
                `INSERT INTO users (user_id, userImageIds, pinnedArtworkIds) VALUES (?, ?, ?)`,
                [userId, JSON.stringify([]), JSON.stringify([artwork.entryId])]
            );
        } else {
            const pinIds = JSON.parse(user.pinnedArtworkIds || "[]");
            if (!pinIds.includes(artwork.entryId)) {
                pinIds.push(artwork.entryId);
                // Update the updatedAt timestamp
                await db.run(`UPDATE users SET pinnedArtworkIds = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ?`, [
                    JSON.stringify(pinIds),
                    userId,
                ]);
            }
        }

        await db.run(
            `INSERT INTO pinned_artworks 
            (entryId, user_id, title, image_urls, descriptions, artist, artist_names, thumbnail_url, url, rights, keywords, worldCoords, regionId, isRepresentative, priority, taskNumber)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
            artwork.entryId,
            userId,
            artwork.title || "",
            JSON.stringify(artwork.image_urls || {}),
            JSON.stringify(artwork.descriptions || {}),
            artwork.artist || "",
            JSON.stringify(artwork.artist_names || []),
            artwork.thumbnail_url || "",
            artwork.url || "",
            artwork.rights || "",
            JSON.stringify(artwork.keywords || []),
            artwork.worldCoords ? JSON.stringify(artwork.worldCoords) : null,
            artwork.regionId ?? null,
            artwork.isRepresentative ?? null,
            artwork.priority ?? null,
            artwork.taskNumber ?? null  // Add this line
            ]
        );

        res.json({ success: true, message: "Pinned artwork added." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Remove pinned artwork
 */
app.delete("/remove-user-pin/:userId/:entryId", async (req, res) => {
    try {
        const { userId, entryId } = req.params;
        if (!userId || !entryId) {
            return res.status(400).json({ error: "Missing userId or entryId" });
        }

        const db = await dbPromise;
        
        // Check if user exists
        const user = await db.get(`SELECT * FROM users WHERE user_id = ?`, [userId]);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Remove from pinned_artworks table
        const result = await db.run(`DELETE FROM pinned_artworks WHERE user_id = ? AND entryId = ?`, [userId, entryId]);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: "Pinned artwork not found" });
        }

        // Update user's pinnedArtworkIds array
        const pinIds = JSON.parse(user.pinnedArtworkIds || "[]");
        const updatedPinIds = pinIds.filter(id => id !== entryId);
        
        await db.run(`UPDATE users SET pinnedArtworkIds = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ?`, [
            JSON.stringify(updatedPinIds),
            userId,
        ]);

        res.json({ success: true, message: "Pinned artwork removed." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get user data (images + pinned artworks)
 */
app.get("/get-user/:id", async (req, res) => {
    try {
        const { id: userId } = req.params;
        const db = await dbPromise;

        const user = await db.get(`SELECT * FROM users WHERE user_id = ?`, [userId]);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const images = await db.all(`SELECT * FROM user_images WHERE user_id = ? ORDER BY dateAdded DESC`, [userId]);
        const pins = await db.all(`SELECT * FROM pinned_artworks WHERE user_id = ? ORDER BY pinnedAt DESC`, [userId]);

        // Parse JSON fields for images
        const parsedImages = images.map(img => ({
            ...img,
            worldCoords: JSON.parse(img.worldCoords || '[]'),
            anchors: JSON.parse(img.anchors || '[]')
        }));

        // Parse JSON fields for pins
        const parsedPins = pins.map(pin => ({
            ...pin,
            image_urls: JSON.parse(pin.image_urls || '{}'),
            descriptions: JSON.parse(pin.descriptions || '{}'),
            artist_names: JSON.parse(pin.artist_names || '[]'),
            keywords: JSON.parse(pin.keywords || '[]'),
            worldCoords: JSON.parse(pin.worldCoords || '[]')
        }));

        res.json({
            ...user,
            userImageIds: JSON.parse(user.userImageIds || "[]"),
            pinnedArtworkIds: JSON.parse(user.pinnedArtworkIds || "[]"),
            userImages: parsedImages,
            pinnedArtworks: parsedPins,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Delete a user + all related records
 */
app.delete("/user/:id", async (req, res) => {
    try {
        const { id: userId } = req.params;
        const db = await dbPromise;
        
        // Check if user exists first
        const user = await db.get(`SELECT * FROM users WHERE user_id = ?`, [userId]);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await db.run(`DELETE FROM user_images WHERE user_id = ?`, [userId]);
        await db.run(`DELETE FROM pinned_artworks WHERE user_id = ?`, [userId]);
        await db.run(`DELETE FROM users WHERE user_id = ?`, [userId]);

        res.json({ success: true, message: `User ${userId} and related data deleted.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Log user event
 */
app.post("/log-event", async (req, res) => {
    try {
        const { userId, timestamp, message, ...extraFields } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "Missing userId" });
        }

        const db = await dbPromise;
        
        // Combine all event data
        const eventData = {
            message: message || "",
            ...extraFields
        };

        const eventTimestamp = timestamp || new Date().toISOString();

        await db.run(
            `INSERT INTO user_logs (user_id, timestamp, message, event_data) 
             VALUES (?, ?, ?, ?)`,
            [
                userId,
                eventTimestamp,
                message || "",
                JSON.stringify(eventData)
            ]
        );

        res.json({ success: true, message: "Event logged" });
    } catch (err) {
        console.error("Error logging event:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get user logs (with optional filtering)
 */
app.get("/get-logs/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 100, offset = 0, since, until } = req.query;
        
        const db = await dbPromise;
        
        let query = `SELECT * FROM user_logs WHERE user_id = ?`;
        const params = [userId];
        
        if (since) {
            query += ` AND timestamp >= ?`;
            params.push(since);
        }
        
        if (until) {
            query += ` AND timestamp <= ?`;
            params.push(until);
        }
        
        query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        const logs = await db.all(query, params);
        
        // Parse the JSON event_data for each log
        const parsedLogs = logs.map(log => ({
            ...log,
            event_data: JSON.parse(log.event_data)
        }));
        
        res.json({ logs: parsedLogs });
    } catch (err) {
        console.error("Error fetching logs:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Clear old logs (optional maintenance endpoint)
 */
// app.delete("/clear-old-logs", async (req, res) => {
//     try {
//         const { daysToKeep = 30 } = req.body;
//         const db = await dbPromise;
        
//         const cutoffDate = new Date();
//         cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
//         const result = await db.run(
//             `DELETE FROM user_logs WHERE timestamp < ?`,
//             [cutoffDate.toISOString()]
//         );
        
//         res.json({ 
//             success: true, 
//             message: `Deleted ${result.changes} old log entries` 
//         });
//     } catch (err) {
//         console.error("Error clearing logs:", err);
//         res.status(500).json({ error: err.message });
//     }
// });

// === add new endpoints here ==== // 


// Print some DB stats on startup
(async () => {
    const db = await dbPromise;

    const userCountRow = await db.get("SELECT COUNT(*) as count FROM users");
    const userImagesCountRow = await db.get("SELECT COUNT(*) as count FROM user_images");
    const pinnedArtworksCountRow = await db.get("SELECT COUNT(*) as count FROM pinned_artworks");

    console.log("=== Database Stats ===");
    console.log(`Users count: ${userCountRow.count}`);
    console.log(`User images count: ${userImagesCountRow.count}`);
    console.log(`Pinned artworks count: ${pinnedArtworksCountRow.count}`);
    console.log("======================");

    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
        console.log(`API available at http://localhost:${port} OR https://snailbunny.site/artographer-data/`);
    });
})();

export default app;
