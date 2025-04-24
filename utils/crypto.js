require('dotenv').config();
const CryptoJS = require('crypto-js');
const key = process.env.ENCRYPTION_KEY;

function encrypt(text) {
  return CryptoJS.AES.encrypt(text, key).toString();
}

function decrypt(cipher) {
  const bytes = CryptoJS.AES.decrypt(cipher, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

module.exports = { encrypt, decrypt };
