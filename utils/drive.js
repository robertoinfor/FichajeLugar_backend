const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');

const apiCreds = JSON.parse(process.env.API_DRIVE_KEY);

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
