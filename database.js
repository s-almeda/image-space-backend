import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function initDB() {
  const db = await open({
    filename: "./database.db",
    driver: sqlite3.Database,
  });

  // Create users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      userImageIds TEXT NOT NULL DEFAULT '[]', -- JSON array of strings (API expects this name)
      pinnedArtworkIds TEXT NOT NULL DEFAULT '[]', -- JSON array of strings (API expects this name)
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  // Add timestamp columns if they don't exist
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);
  } catch (e) { /* Column exists */ }
  
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);
  } catch (e) { /* Column exists */ }

  // Add taskNumber column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE pinned_artworks ADD COLUMN taskNumber INTEGER`);
  } catch (e) { /* Column exists */ }

  // Create user_images table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_images (
      userimage_id TEXT PRIMARY KEY, -- API expects this name
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      imageUrl TEXT NOT NULL, -- API expects camelCase
      worldCoords TEXT NOT NULL, -- API expects array format [x, y]
      regionId TEXT, -- API expects TEXT, not INTEGER
      confidence REAL NOT NULL,
      anchors TEXT NOT NULL, -- JSON array
      dateAdded TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  // Create pinned_artworks table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS pinned_artworks (
      entryId TEXT PRIMARY KEY, -- API expects this name
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      image_urls TEXT NOT NULL, -- JSON object
      descriptions TEXT NOT NULL, -- JSON object
      artist TEXT NOT NULL,
      artist_names TEXT NOT NULL, -- JSON array
      thumbnail_url TEXT NOT NULL,
      url TEXT NOT NULL,
      rights TEXT NOT NULL,
      keywords TEXT NOT NULL, -- JSON array
      worldCoords TEXT, -- API expects array format [x, y]
      regionId TEXT, -- API expects TEXT
      isRepresentative INTEGER DEFAULT 0, -- API expects camelCase
      priority INTEGER,
      isPinned INTEGER DEFAULT 1, -- API expects camelCase
      pinnedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      UNIQUE(user_id, entryId)
    );
  `);

  // Add this table creation after your other tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      message TEXT,
      event_data TEXT NOT NULL, -- JSON string containing all event fields
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  // Add index for performance
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_user_logs_user_id ON user_logs(user_id)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_user_logs_timestamp ON user_logs(timestamp)`);

  // Create indexes for better performance
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_user_images_user_id ON user_images(user_id)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_user_images_date ON user_images(dateAdded)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_pinned_artworks_user_id ON pinned_artworks(user_id)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_pinned_artworks_date ON pinned_artworks(pinnedAt)`);

  console.log("Database initialized and migrated to match API expectations!");
  return db;
}

const dbPromise = initDB();

export default dbPromise;

/*
  Comments related to migration of old data:

  // Handle column renames for existing tables
  // Check if old column names exist and rename them
  // const userTableInfo = await db.all("PRAGMA table_info(users)");
  // const hasOldImageIds = userTableInfo.some(col => col.name === 'user_image_ids');
  // const hasOldPinnedIds = userTableInfo.some(col => col.name === 'pinned_artwork_ids');
  
  // if (hasOldImageIds || hasOldPinnedIds) {
  //   // Migrate data from old column names to new ones
  //   await db.exec(`
  //     CREATE TABLE users_new (
  //       user_id TEXT PRIMARY KEY,
  //       userImageIds TEXT NOT NULL DEFAULT '[]',
  //       pinnedArtworkIds TEXT NOT NULL DEFAULT '[]',
  //       createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  //       updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  //     );
  //   `);
    
  //   // Copy data with column name mapping
  //   await db.exec(`
  //     INSERT INTO users_new (user_id, userImageIds, pinnedArtworkIds)
  //     SELECT 
  //       user_id,
  //       COALESCE(user_image_ids, '[]'),
  //       COALESCE(pinned_artwork_ids, '[]')
  //     FROM users;
  //   `);
    
  //   // Replace old table
  //   await db.exec(`DROP TABLE users`);
  //   await db.exec(`ALTER TABLE users_new RENAME TO users`);
  // }

  // Handle column renames for user_images if needed
  // const imageTableInfo = await db.all("PRAGMA table_info(user_images)");
  // const hasOldImageUrl = imageTableInfo.some(col => col.name === 'image_url');
  // const hasOldWorldCoords = imageTableInfo.some(col => col.name === 'world_x');
  
  // if (hasOldImageUrl || hasOldWorldCoords) {
  //   // Migrate user_images table
  //   await db.exec(`
  //     CREATE TABLE user_images_new (
  //       userimage_id TEXT PRIMARY KEY,
  //       user_id TEXT NOT NULL,
  //       title TEXT NOT NULL,
  //       imageUrl TEXT NOT NULL,
  //       worldCoords TEXT NOT NULL,
  //       regionId TEXT,
  //       confidence REAL NOT NULL,
  //       anchors TEXT NOT NULL,
  //       dateAdded TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  //       createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  //       FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  //     );
  //   `);
    
  //   // Copy data with transformations
  //   await db.exec(`
  //     INSERT INTO user_images_new (userimage_id, user_id, title, imageUrl, worldCoords, regionId, confidence, anchors, dateAdded)
  //     SELECT 
  //       userimage_id,
  //       user_id,
  //       title,
  //       COALESCE(image_url, imageUrl),
  //       CASE 
  //         WHEN world_x IS NOT NULL AND world_y IS NOT NULL 
  //         THEN '[' || world_x || ',' || world_y || ']'
  //         ELSE worldCoords
  //       END,
  //       CAST(region_id AS TEXT),
  //       confidence,
  //       anchors,
  //       COALESCE(date_added, dateAdded, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  //     FROM user_images;
  //   `);
    
  //   await db.exec(`DROP TABLE user_images`);
  //   await db.exec(`ALTER TABLE user_images_new RENAME TO user_images`);
  // }

  // Handle column renames for pinned_artworks if needed
  // const artworkTableInfo = await db.all("PRAGMA table_info(pinned_artworks)");
  // const hasOldEntryId = artworkTableInfo.some(col => col.name === 'entry_id');
  // const hasOldWorldX = artworkTableInfo.some(col => col.name === 'world_x');
  
  // if (hasOldEntryId || hasOldWorldX) {
  //   // Migrate pinned_artworks table
  //   await db.exec(`
  //     CREATE TABLE pinned_artworks_new (
  //       entryId TEXT PRIMARY KEY,
  //       user_id TEXT NOT NULL,
  //       title TEXT NOT NULL,
  //       image_urls TEXT NOT NULL,
  //       descriptions TEXT NOT NULL,
  //       artist TEXT NOT NULL,
  //       artist_names TEXT NOT NULL,
  //       thumbnail_url TEXT NOT NULL,
  //       url TEXT NOT NULL,
  //       rights TEXT NOT NULL,
  //       keywords TEXT NOT NULL,
  //       worldCoords TEXT,
  //       regionId TEXT,
  //       isRepresentative INTEGER DEFAULT 0,
  //       priority INTEGER,
  //       isPinned INTEGER DEFAULT 1,
  //       pinnedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  //       createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  //       FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  //       UNIQUE(user_id, entryId)
  //     );
  //   `);
    
  //   // Copy data with transformations
  //   await db.exec(`
  //     INSERT INTO pinned_artworks_new (entryId, user_id, title, image_urls, descriptions, artist, artist_names, thumbnail_url, url, rights, keywords, worldCoords, regionId, isRepresentative, priority, isPinned)
  //     SELECT 
  //       COALESCE(entry_id, entryId),
  //       user_id,
  //       title,
  //       image_urls,
  //       descriptions,
  //       artist,
  //       artist_names,
  //       thumbnail_url,
  //       url,
  //       rights,
  //       keywords,
  //       CASE 
  //         WHEN world_x IS NOT NULL AND world_y IS NOT NULL 
  //         THEN '[' || world_x || ',' || world_y || ']'
  //         ELSE worldCoords
  //       END,
  //       CAST(COALESCE(region_id, regionId) AS TEXT),
  //       COALESCE(is_representative, isRepresentative, 0),
  //       priority,
  //       COALESCE(is_pinned, isPinned, 1)
  //     FROM pinned_artworks;
  //   `);
    
  //   await db.exec(`DROP TABLE pinned_artworks`);
  //   await db.exec(`ALTER TABLE pinned_artworks_new RENAME TO pinned_artworks`);
  // }
*/