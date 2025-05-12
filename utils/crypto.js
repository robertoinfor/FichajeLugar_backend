require('dotenv').config();
const CryptoJS = require('crypto-js');
const key = process.env.ENCRYPTION_KEY;

// Encripto la contraseña
function encrypt(text) {
  return CryptoJS.AES.encrypt(text, key).toString();
}

// Desencripto la contraseña
function decrypt(cipher) {
  const bytes = CryptoJS.AES.decrypt(cipher, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

module.exports = { encrypt, decrypt };
