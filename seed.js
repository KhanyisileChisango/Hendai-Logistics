import Database from "better-sqlite3";

const db = new Database("HandeiData.db");

// Ensure the table exists
db.exec(`
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
`);

const drivers = [
  {
    name: "John Doe",
    phone: "+263771000001",
    vehicle_type: "2-ton truck",
    license_plate: "ABE 1234",
    location: "Harare CBD",
    cost_per_km: 1.5,
    capacity: "2000kg"
  },
  {
    name: "Jane Smith",
    phone: "+263771000002",
    vehicle_type: "4-seater sedan",
    license_plate: "ACE 5678",
    location: "Avondale",
    cost_per_km: 0.8,
    capacity: "4 passengers"
  },
  {
    name: "Michael Johnson",
    phone: "+263771000003",
    vehicle_type: "Minibus",
    license_plate: "ADE 9012",
    location: "Mbare",
    cost_per_km: 1.2,
    capacity: "15 passengers"
  },
  {
    name: "Tariro Ncube",
    phone: "+263771000004",
    vehicle_type: "1-ton pickup",
    license_plate: "AEB 3456",
    location: "Borrowdale",
    cost_per_km: 1.0,
    capacity: "1000kg"
  },
  {
    name: "David Moyo",
    phone: "+263771000005",
    vehicle_type: "5-ton truck",
    license_plate: "AFC 7890",
    location: "Msasa",
    cost_per_km: 2.5,
    capacity: "5000kg"
  },
  {
    name: "Sarah Gumbo",
    phone: "+263771000006",
    vehicle_type: "Hatchback",
    license_plate: "AGD 2345",
    location: "Mt Pleasant",
    cost_per_km: 0.7,
    capacity: "3 passengers"
  }
];

const insert = db.prepare(`
  INSERT INTO drivers (name, phone, vehicle_type, license_plate, location, cost_per_km, capacity, status) 
  VALUES (?, ?, ?, ?, ?, ?, ?, 'available')
`);

db.transaction(() => {
  for (const driver of drivers) {
    insert.run(
      driver.name,
      driver.phone,
      driver.vehicle_type,
      driver.license_plate,
      driver.location,
      driver.cost_per_km,
      driver.capacity
    );
  }
})();

console.log(`Successfully seeded ${drivers.length} drivers into HandeiData.db!`);
