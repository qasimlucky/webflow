const User = require("../model/Users"); 
const bcrypt = require("bcrypt");

const seedDatabaseAndCreateSuperAdmin = async () => {
  try {
    console.log("Checking for existing users...");
    
  
    const users = await User.find({role : "Admin"});
    console.log("Users found:", users.length);
    if (users.length === 0) {
      console.log("No users found. Creating default Admin...");

      const hashedPassword = await bcrypt.hash("Admin@123", 12);

      await User.create({
        email: "bookingbot@gmail.com",
        password: hashedPassword,
        role: "Admin",
        userName: "Muddasar Rehman",
      });

      console.log("Default Admin created successfully.");
    } else {
      console.log("Users already exist in the database. Skipping Admin creation.");
    }
  } catch (error) {
    console.error("Error during admin creation:", error);
    throw error; 
  }
};
module.exports = seedDatabaseAndCreateSuperAdmin;


