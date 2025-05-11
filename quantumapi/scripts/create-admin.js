// create-admin.js - Script to create an admin user
const bcrypt = require('bcrypt');
const User = require('../models/User');

async function createAdmin() {
  try {
    // Admin user details - CHANGE THESE VALUES as needed
    const adminData = {
      firstName: 'Admin',
      lastName: 'User',
      username: 'admin',
      email: 'admin@example.com',
      password: 'Admin123',  // CHANGE THIS to a secure password!
      role: 'admin'
    };

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminData.password, salt);
    
    // Update the admin data with the hashed password
    adminData.password = hashedPassword;
    
    // Check if the admin user already exists
    const existingUser = User.findByEmail(adminData.email) || User.findByUsername(adminData.username);
    
    if (existingUser) {
      console.log('Admin user already exists. You can use these credentials to login:');
      console.log(`Username: ${adminData.username}`);
      console.log(`Email: ${adminData.email}`);
      console.log(`Password: Use your original password`);
      return;
    }
    
    // Create the admin user
    const userId = await User.createAdmin({
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      username: adminData.username,
      email: adminData.email,
      password: adminData.password,  // This is the plain text password, createAdmin will hash it
      role: 'admin',
      isVerified: 1  // Auto-verify the admin user
    });
    
    if (userId) {
      console.log('Admin user created successfully!');
      console.log('You can use these credentials to login:');
      console.log(`Username: ${adminData.username}`);
      console.log(`Email: ${adminData.email}`);
      console.log(`Password: ${adminData.password.startsWith('$') ? '(use the password you set in the script)' : adminData.password}`);
    } else {
      console.log('Failed to create admin user. Check the error logs.');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

// Run the function
createAdmin();
