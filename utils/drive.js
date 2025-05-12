const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');

const apiCreds = {
  type: process.env.GOOGLE_TYPE,
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT
};

const storage = multer.memoryStorage();
exports.uploadMiddleware = multer({ storage });

// Realiza la autentificación del drive
exports.authorize = async () => {
  const jwtClient = new google.auth.JWT(
    apiCreds.client_email,
    null,
    apiCreds.private_key,
    ['https://www.googleapis.com/auth/drive']
  );
  await jwtClient.authorize();
  return jwtClient;
};

// Carga el archivo
exports.uploadFile = (authClient, image) =>
  new Promise((resolve, reject) => {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const bufferStream = new stream.PassThrough();
    bufferStream.end(image.buffer);

    drive.files.create({
      resource: {
        name: image.originalname,
        parents: ['1s43bmlgQvDSGl4G0_Q5XLuWwpk3xM01E']
      },
      media: {
        mimeType: image.mimetype,
        body: bufferStream
      },
      fields: 'id'
    }, (err, file) => err ? reject(err) : resolve(file));
  });
