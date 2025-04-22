const admin = require('firebase-admin');

const serviceAccount = {
  project_id:   process.env.PROJECT_ID_KEY,
  private_key:  process.env.PRIVATE_ID_KEY,
  client_email: process.env.CLIENT_MAIL_KEY,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const fcm = admin.messaging();

module.exports = { admin, fcm };
