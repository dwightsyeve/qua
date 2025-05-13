const db = require('./database'); // Corrected the path to the database module

function addMissingUserColumns() {
  try {
    // Check if columns already exist to prevent errors
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const columns = tableInfo.map(col => col.name);

    // Add resetToken column if it doesn't exist
    if (!columns.includes('resetToken')) {
      db.prepare("ALTER TABLE users ADD COLUMN resetToken TEXT").run();
      console.log("Added resetToken column to users table");
    }

    // Add resetTokenExpiry column if it doesn't exist
    if (!columns.includes('resetTokenExpiry')) {
      db.prepare("ALTER TABLE users ADD COLUMN resetTokenExpiry TEXT").run();
      console.log("Added resetTokenExpiry column to users table");
    }

    // Add updatedAt column if it doesn't exist
    if (!columns.includes('updatedAt')) {
      db.prepare("ALTER TABLE users ADD COLUMN updatedAt TIMESTAMP").run();
      console.log("Added updatedAt column to users table");
      // Optionally, update existing rows if you want them to have a timestamp
      // For example, set to the current time when the migration is run:
      db.prepare("UPDATE users SET updatedAt = CURRENT_TIMESTAMP WHERE updatedAt IS NULL").run();
      console.log("Initialized updatedAt for existing users");
    }

    console.log("User table columns check/update completed successfully");
  } catch (error) {
    console.error("Error updating user table columns:", error);
  }
}

// Run the migration
addMissingUserColumns();

console.log("Migration script completed");