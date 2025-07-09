// utils/hashAdminPassword.js
const bcrypt = require('bcryptjs');

async function hashPassword(plainPassword) {
  const hash = await bcrypt.hash(plainPassword, 10);
  console.log('Hashed Password:', hash);
}

hashPassword('Admin123@');
