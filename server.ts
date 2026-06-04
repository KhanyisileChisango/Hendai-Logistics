import express from "express";
import path from "path";
import Database from "better-sqlite3";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// --- Database Setup ---
const db = new Database("HandeiData.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    pickup TEXT,
    destination TEXT,
    pickup_time TEXT,
    cargo_details TEXT,
    proposed_payment REAL
  );

  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    vehicle_type TEXT,
    license_plate TEXT,
    location TEXT,
    cost_per_km REAL,
    capacity TEXT,
    status TEXT DEFAULT 'available'
  );

  CREATE TABLE IF NOT EXISTS sessions (
    phone_number TEXT PRIMARY KEY,
    role TEXT,
    step TEXT,
    data TEXT
  );
`);

// --- API Endpoints ---

// Get all data for dashboard visualization
app.get("/api/data", (req, res) => {
  const clients = db.prepare("SELECT * FROM clients").all();
  const drivers = db.prepare("SELECT * FROM drivers").all();
  const sessions = db.prepare("SELECT * FROM sessions").all();
  res.json({ clients, drivers, sessions });
});

// Clear DB (for testing/demo)
app.post("/api/clear", (req, res) => {
  db.exec("DELETE FROM clients; DELETE FROM drivers; DELETE FROM sessions;");
  res.json({ status: "cleared" });
});

// USSD / SMS Webhook Endpoint
app.post("/api/sms", (req, res) => {
  const { from, message } = req.body;
  
  if (!from || !message) {
    return res.status(400).json({ error: "Missing from or message." });
  }

  const text = message.trim();
  let reply = "";

  // Find existing session
  let sessionRecord = db.prepare("SELECT * FROM sessions WHERE phone_number = ?").get(from) as any;
  let session = sessionRecord ? { 
    phone_number: sessionRecord.phone_number, 
    role: sessionRecord.role, 
    step: sessionRecord.step, 
    data: JSON.parse(sessionRecord.data) 
  } : null;

  if (!session) {
    // New interaction
    session = { phone_number: from, role: null, step: "INIT", data: {} };
    db.prepare("INSERT INTO sessions (phone_number, role, step, data) VALUES (?, ?, ?, ?)").run(from, null, "INIT", "{}");
    reply = "Welcome to Handei Logistics USSD.\nAre you a:\n1. Client\n2. Driver";
  } else {
    // Session explicitly closed or resting, restart if 'M' or just any char
    if (session.step === "DONE" && text.toUpperCase() === "M") {
       session.step = "INIT";
       session.role = null;
       session.data = {};
       reply = "Welcome back to Handei Logistics.\nAre you a:\n1. Client\n2. Driver";
    }
    // Existing interaction processing
    else if (session.step === "INIT") {
      if (text === "1") {
        session.role = "client";
        session.step = "CLIENT_NAME";
        reply = "Welcome Client. Please enter your full name:";
      } else if (text === "2") {
        session.role = "driver";
        session.step = "DRIVER_NAME";
        reply = "Welcome Driver. Please enter your full name:";
      } else {
        reply = "Invalid choice.\nAre you a:\n1. Client\n2. Driver";
      }
    } 
    // ------- CLIENT FLOW -------
    else if (session.role === "client") {
      if (session.step === "CLIENT_NAME") {
        session.data.name = text;
        session.step = "CLIENT_PICKUP";
        reply = "Please enter your pickup location:";
      } else if (session.step === "CLIENT_PICKUP") {
        session.data.pickup = text;
        session.step = "CLIENT_DESTINATION";
        reply = "Please enter your destination:";
      } else if (session.step === "CLIENT_DESTINATION") {
        session.data.destination = text;
        session.step = "CLIENT_TIME";
        reply = "What time do you want to be picked up? (e.g. 14:00)";
      } else if (session.step === "CLIENT_TIME") {
        session.data.pickup_time = text;
        session.step = "CLIENT_CARGO";
        reply = "What is the nature and size of cargo, or number of passengers? (e.g. 2 tons timber, or 4 passengers)";
      } else if (session.step === "CLIENT_CARGO") {
        session.data.cargo_details = text;
        session.step = "CLIENT_PAYMENT";
        reply = "What is your proposed payment amount in USD? (e.g. 50)";
      } else if (session.step === "CLIENT_PAYMENT") {
        session.data.proposed_payment = parseFloat(text) || 0;
        session.step = "CLIENT_SELECT_DRIVER";

        // 1. Save client to DB
        db.prepare(`
          INSERT INTO clients (name, phone, pickup, destination, pickup_time, cargo_details, proposed_payment) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          session.data.name, from, session.data.pickup, session.data.destination, 
          session.data.pickup_time, session.data.cargo_details, session.data.proposed_payment
        );

        // 2. Query available drivers
        const drivers = db.prepare("SELECT * FROM drivers WHERE status = 'available'").all() as any[];

        if (drivers.length === 0) {
          reply = "No drivers currently available. Please try again later. Reply 'M' for main menu.";
          session.step = "DONE";
        } else {
          // Simulate matching & distance calculation
          // In production, integrate Google Maps Routes API here using coordinates of pickup & driver location
          const matchedDrivers = drivers.map(d => {
            const distance = Math.floor(Math.random() * 40) + 5; // Simulating Google Maps distance matrix (5-45km)
            const totalCost = d.cost_per_km * distance;
            return { ...d, distance, totalCost };
          }).sort((a, b) => a.totalCost - b.totalCost).slice(0, 3); // Take top 3 cheapest

          session.data.matchedDrivers = matchedDrivers;

          reply = "Top 3 drivers near you:\n";
          matchedDrivers.forEach((d, index) => {
             reply += `\n${index + 1}. ${d.name} (${d.phone})\n${d.distance}km away. Plate: ${d.license_plate}. Cost: $${d.totalCost.toFixed(2)}\n`;
          });
          reply += "\nReply with the number (ex: 1) to select a driver. Feel free to call them to negotiate first.";
        }

      } else if (session.step === "CLIENT_SELECT_DRIVER") {
        const choice = parseInt(text);
        const matches = session.data.matchedDrivers || [];
        
        if (choice >= 1 && choice <= matches.length) {
          const selectedDriver = matches[choice - 1];
          // Mark driver unavailable
          db.prepare("UPDATE drivers SET status = 'unavailable' WHERE id = ?").run(selectedDriver.id);
          
          reply = `Journey confirmed with ${selectedDriver.name} (${selectedDriver.phone}). They are now unavailable to others. Reply 'M' for main menu.`;
          session.step = "DONE";
        } else {
          reply = `Invalid choice. Please reply with a number between 1 and ${matches.length}.`;
        }
      }
    } 
    // ------- DRIVER FLOW -------
    else if (session.role === "driver") {
      if (session.step === "DRIVER_NAME") {
        session.data.name = text;
        session.step = "DRIVER_VEHICLE";
        reply = "What is your vehicle type/size? (e.g. 2-ton truck, 4-seater sedan)";
      } else if (session.step === "DRIVER_VEHICLE") {
        session.data.vehicle_type = text;
        session.step = "DRIVER_PLATE";
        reply = "What is your license plate number?";
      } else if (session.step === "DRIVER_PLATE") {
        session.data.license_plate = text;
        session.step = "DRIVER_LOCATION";
        reply = "What is your current location/city? (e.g. Harare CBD)";
      } else if (session.step === "DRIVER_LOCATION") {
        session.data.location = text;
        session.step = "DRIVER_COST";
        reply = "What is your cost per km in USD? (e.g. 1.5)";
      } else if (session.step === "DRIVER_COST") {
        session.data.cost_per_km = parseFloat(text) || 1.0;
        session.step = "DRIVER_CAPACITY";
        reply = "What is your maximum passenger or cargo capacity? (e.g. 4 passengers or 2000kg)";
      } else if (session.step === "DRIVER_CAPACITY") {
        session.data.capacity = text;

        // Save driver to DB
        db.prepare(`
          INSERT INTO drivers (name, phone, vehicle_type, license_plate, location, cost_per_km, capacity, status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, 'available')
        `).run(
          session.data.name, from, session.data.vehicle_type, session.data.license_plate, 
          session.data.location, session.data.cost_per_km, session.data.capacity
        );

        reply = "Registration complete! You are now listed as 'available' to clients. Reply 'M' to return to main menu.";
        session.step = "DONE";
      }
    }
    
    // Catch-all
    if (session.step === "DONE" && text.toUpperCase() !== "M") {
       reply = reply || "Transaction complete. Reply 'M' to go to the main menu.";
    }

    // Save state back to DB
    db.prepare("UPDATE sessions SET role = ?, step = ?, data = ? WHERE phone_number = ?").run(
      session.role, session.step, JSON.stringify(session.data), from
    );
  }

  res.json({ reply });
});

// --- Boot Server ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
