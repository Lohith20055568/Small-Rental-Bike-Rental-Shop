const express = require("express");
const cors = require("cors");
const db = require("./db.js"); 

const app = express();
const HTTP_PORT = 8000;

app.use(cors()); 
app.use(express.json()); 

// --- Server Start ---
app.listen(HTTP_PORT, () => {
    console.log(`Server running on port ${HTTP_PORT}`);
});

// --- Root Endpoint ---
app.get("/", (req, res, next) => {
    res.json({ "message": "API Status: OK" });
});

app.post("/api/items", (req, res, next) => {
    const { Name, Category, DailyRate, Status, Condition, LastServiceDate } = req.body;
    
    // Basic Validation
    if (!Name || !DailyRate) {
        res.status(400).json({ "error": "Missing required fields (Name or DailyRate)" });
        return;
    }

    const sql = `INSERT INTO items (Name, Category, DailyRate, Status, Condition, LastServiceDate) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [
        Name, 
        Category || 'Uncategorized', 
        DailyRate, 
        Status || 'Available', 
        Condition || 'Good',
        LastServiceDate || new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    ];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": { ItemID: this.lastID, ...req.body }
        });
    });
});



app.get("/api/items", (req, res, next) => {
    let sql = "SELECT * FROM items";
    const params = [];
    
    
    if (req.query.status) {
        sql += " WHERE Status = ?";
        params.push(req.query.status);
    }
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});




