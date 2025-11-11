const sqlite3 = require('sqlite3').verbose();

// Use a file for persistent storage (replace rental.db with your preferred name)
const DBSOURCE = "rental.db"; 

let db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        // Cannot open database
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        // SQL to create the 'items' table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS items (
            ItemID INTEGER PRIMARY KEY AUTOINCREMENT,
            Name TEXT NOT NULL,
            Category TEXT,
            DailyRate REAL NOT NULL,
            Status TEXT NOT NULL, 
            Condition TEXT,
            LastServiceDate TEXT
        )`, (err) => {
            if (err) {
                // Table already created
            } else {
                // Table just created, optionally insert initial data for testing
                console.log('Items table created (or already exists).');
            }
        });
    }
});

module.exports = db;
