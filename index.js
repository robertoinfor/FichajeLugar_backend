const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const port = process.env.PORT || 8000;
const Crypto = require('crypto-js');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const cron = require('node-cron');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
const stream = require ('stream');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const authToken = process.env.TOKEN_NOTION
const usuariosDb = process.env.USERSDB_KEY
const fichajeDb = process.env.SIGNINGS_KEY
const tokenDB = process.env.TOKENS_KEY
const notion = new Client({ auth: authToken })
const key = process.env.ENCRYPTION_KEY;
const fcmDB = process.env.FCM_KEY;
const placesDB = process.env.PLACES_KEY;
const storage = multer.memoryStorage();
const upload = multer({ storage });
const api_drive = require('./API_DRIVE.json')

const SCOPE = ['https://www.googleapis.com/auth/drive'];

async function authorize(){
    const jwtClient = new google.auth.JWT(
        api_drive.client_email,
        null,
        api_drive.private_key,
        SCOPE
    );
    await jwtClient.authorize();
    return jwtClient;
}

async function uploadFile(authClient, image){
    return new Promise((resolve, rejected) => {
        const bufferStream = new stream.PassThrough();
        const drive = google.drive({ version: 'v3', auth: authClient });
        bufferStream.end(image.buffer);
        var fileMetaData = {
            name: image.originalname,    
            parents: ['1s43bmlgQvDSGl4G0_Q5XLuWwpk3xM01E']
        }
        drive.files.create({
            resource: fileMetaData,
            media: {
                body: bufferStream,
                mimeType: image.mimetype
            },
            fields: 'id'
        }, function(error, file){
            if(error){
                return rejected(error);
            }
            resolve(file);
        });
    });
}


app.post('/upload', upload.single('file'), async (req, res) => {
    try {
      const authClient = await authorize();
      const file = await uploadFile(authClient, req.file);
      const fileUrl = `https://drive.google.com/thumbnail?id=${file.data.id}`;
      res.status(200).json({ fileUrl });
    } catch (error) {
      console.error("Error en la subida:", error);
      res.status(500).json({ error: error.toString() });
    }
  });
  
  
app.post('/PostUser', jsonParser, async (req, res) => {
    const { Nombre, Pwd, Email, Rol, Fecha_alta, Horas, Foto } = req.body;
    try {
        const hash = Crypto.AES.encrypt(Pwd, key).toString();
        const response = await notion.pages.create({
            parent: {
                database_id: usuariosDb,
            },
            properties: {
                Nombre: {
                    title: [{
                        text: {
                            content: Nombre
                        },
                    },],
                },
                Pwd: {
                    rich_text: [{
                        text: {
                            content: hash
                        },
                    },],
                },
                Email: {
                    email: Email
                },
                Rol: {
                    select: {
                        name: Rol
                    },

                },
                Fecha_alta: {
                    date:
                    {
                        start: Fecha_alta
                    },
                },
                Horas: { number: Horas },
                Foto: Foto
            },
        });

        res.send(response);
    } catch (error) {
        console.log(error);
    }
});

app.get('/GetUsers', async (req, res) => {
    try {
        const response = await notion.databases.query({
            database_id: usuariosDb,
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ]
        });

        res.send(response);
        const { results } = response;
    } catch (error) {
        console.log(error);
    }
});

app.post('/login', async (req, res) => {
    const { login, password } = req.body;
    try {
        const response = await notion.databases.query({
            database_id: usuariosDb,
            filter: {
                or: [
                    {
                        property: "Email",
                        email: { equals: login }
                    },
                    {
                        property: "Nombre",
                        title: { contains: login }
                    }
                ]
            }
        });

        if (response.results.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const usuario = response.results[0];
        const storedPassword = usuario.properties.Pwd.rich_text[0]?.text.content;
        const bytes = Crypto.AES.decrypt(storedPassword, key);
        var originalPwd = bytes.toString(Crypto.enc.Utf8);

        if (password !== originalPwd) {
            return res.status(401).json({ message: "Contraseña incorrecta" });
        }

        res.status(200).json({
            id: usuario.id,
            nombre: usuario.properties.Nombre.title[0]?.plain_text,
            email: usuario.properties.Email.email,
            Pwd: usuario.properties.Pwd.rich_text[0].text.content,
            rol: usuario.properties.Rol.select.name,
            fecha_alta: usuario.properties.Fecha_alta.date.start
        });

    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ message: "Error en el servidor", error });
    }
});


app.delete('/DeleteUser/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const response = await notion.pages.update(
            {
                page_id: id,
                archived: true,
            }
        );
        if (response) {
            return res.status(200).send({ message: 'Usuario archivado correctamente' });
        } else {
            return res.status(400).send({ message: 'Error al archivar el usuario' });
        }
    } catch (error) {
        console.error('Error al hacer la solicitud a Notion:', error);
        return res.status(500).send({ message: 'Error al eliminar el usuario', error });
    }
});

app.put("/UpdateUser/:id", async (req, res) => {
    const { id } = req.params;
    const { Nombre, Pwd, Email, Rol, Fecha_alta, Horas } = req.body;

    try {
        const user = await notion.pages.retrieve({ page_id: id });
        const hash = Crypto.AES.encrypt(Pwd, key).toString();
        const response = await notion.pages.update(
            {
                page_id: id,
                properties: {
                    Nombre: { title: [{ text: { content: Nombre } }] },
                    Email: { email: Email },
                    Pwd: { rich_text: [{ text: { content: hash }, },], },
                    Rol: { select: { name: Rol } },
                    Fecha_alta: { date: { start: Fecha_alta } },
                    Horas: { number: Horas }
                },
            },
        );
        return res.status(200).json({ message: 'Fichaje actualizado', data: response });
    } catch (error) {
        console.error("Error actualizando usuario:", error);
        return res.status(500).json({ error: error.message });
    }
});

app.get('/GetUserByName/:name', async (req, res) => {
    const { name } = req.params;
    try {
        const response = await notion.databases.query({
            database_id: usuariosDb,
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ],
            filter: {
                property: "Nombre",
                title: { equals: name }
            }
        });

        res.send(response);
        const { results } = response;
    } catch (error) {
        console.log(error);
    }
});

app.post('/GetDecryptedPassword', jsonParser, async (req, res) => {
    const { token } = req.body;
    try {
        const response = await notion.databases.query({
            database_id: tokenDB,
            filter: {
                property: "Id",
                title: { equals: token }
            }
        });

        if (response.results.length === 0) {
            return res.status(404).json({ message: "Token no encontrado" });
        }

        const userId = response.results[0].properties.Empleado.relation[0].id;

        const userResponse = await notion.pages.retrieve({ page_id: userId });
        const storedPassword = userResponse.properties.Pwd.rich_text[0]?.text.content;

        const bytes = Crypto.AES.decrypt(storedPassword, key);
        const decryptedPassword = bytes.toString(Crypto.enc.Utf8);

        res.status(200).json({ password: decryptedPassword });
    } catch (error) {
        console.error("Error al obtener la contraseña:", error);
        res.status(500).json({ message: "Error en el servidor", error });
    }
});


app.get('/GetSignings', async (req, res) => {
    try {
        const response = await notion.databases.query({
            database_id: fichajeDb,
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ]
        });

        res.send(response);
        const { results } = response;
    } catch (error) {
        console.log(error);
    }
});

app.get('/GetSigningUser/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const response = await notion.databases.query({
            database_id: fichajeDb,
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ],
            filter: {
                property: "Empleado",
                relation: { contains: id }
            }
        });

        res.send(response);
        const { results } = response;
    } catch (error) {
        console.log(error);
    }
});

app.get('/GetSigningbyId/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const response = await notion.pages.retrieve({
            page_id: id,
        });

        res.send(response);
        const { results } = response;
    } catch (error) {
        console.log(error);
    }
});

app.post('/PostSigning', jsonParser, async (req, res) => {
    const { Id, Empleado, Tipo, Fecha_hora } = req.body;
    try {
        const response = await notion.pages.create({
            parent: {
                database_id: fichajeDb,
            },
            properties: {
                Fecha_hora: {
                    date: {
                        start: Fecha_hora
                    },
                },
                Empleado: {
                    relation: [{
                        id: Empleado
                    },],
                },
                Tipo: {
                    select: {
                        name: Tipo,
                    }
                },
                Id: {
                    title: [{
                        text: {
                            content: Id
                        }
                    }
                    ]
                },
            },
        });
        res.send(response);
    } catch (error) {
        console.log(error);
    }
});

app.put("/UpdateSigning/:id", async (req, res) => {
    const { id } = req.params;
    const { Empleado, Tipo, Fecha_hora, fecha, hora } = req.body;

    try {
        const response = await notion.pages.update(
            {
                page_id: id,
                properties: {
                    Empleado: { relation: [{ id: Empleado }] },
                    Tipo: { select: { name: Tipo } },
                    Fecha_hora: { date: { start: Fecha_hora }, },
                },
            },
        );
        return res.status(200).json({ message: 'Fichaje actualizado', data: response });
    } catch (error) {
        console.error("Error actualizando usuario:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/GetTokens', async (req, res) => {
    try {
        const response = await notion.databases.query({
            database_id: fcmDB,
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ]
        });

        res.send(response);
        const { results } = response;
    } catch (error) {
        console.log(error);
    }
});

app.post('/PostToken', jsonParser, async (req, res) => {
    const { Id, Empleado, Estado } = req.body;
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15)
    try {
        const response = await notion.pages.create({
            parent: {
                database_id: tokenDB,
            },
            properties: {
                Generado: {
                    date: {
                        start: new Date().toISOString()
                    },
                },
                Empleado: {
                    relation: [{
                        id: Empleado
                    },],
                },
                Caduca: {
                    date: {
                        start: now.toISOString()
                    }
                },
                Estado: {
                    status: {
                        name: Estado
                    }
                },
                Id: {
                    title: [{
                        text: {
                            content: Id
                        }
                    }
                    ]
                },
            },
        });
        const userResponse = await notion.pages.retrieve({ page_id: Empleado });
        const userEmail = userResponse.properties.Email.email;
        await sendTokenEmail(userEmail, Id);
        res.send(response);
    } catch (error) {
        console.log(error);
    }
});

async function sendTokenEmail(userEmail, token) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'robertoinfor03@gmail.com',
            pass: 'cqdi fptn qnxx jarf'
        }
    });

    const mailOptions = {
        from: '"Soporte" <tuemail@gmail.com>',
        to: userEmail,
        subject: "Recuperación de Contraseña",
        text: `Tu código de verificación es: ${token}. Expira en 15 minutos.`,
        html: `<p>Tu código de verificación es: <strong>${token}</strong>. Expira en <strong>15 minutos</strong>.</p>`
    };

    await transporter.sendMail(mailOptions);
}

app.post('/sendNotification', async (req, res) => {
    const { token, title, body } = req.body;

    const message = {
        notification: {
            title: title,
            body: body,
        },
        token: token,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Notificación enviada:', response);
        res.status(200).send({ message: 'Notificación enviada correctamente', response });
    } catch (error) {
        console.error('Error al enviar la notificación:', error);
        res.status(500).send({ message: 'Error al enviar la notificación', error });
    }
});

app.get('/checkToken', async (req, res) => {
    const { userId } = req.query;
    try {
        const response = await notion.databases.query({
            database_id: fcmDB,
            filter: {
                property: "Empleado",
                relation: [{
                    contains: userId,
                }
                ]
            }
        });

        if (response.results.length > 0) {
            const existingToken = response.results[0].properties.Token.title[0].text.content;
            return res.json({ token: existingToken });
        }

        res.json({ token: null });
    } catch (error) {
        console.error("Error al verificar el token FCM:", error);
        res.status(500).json({ error: "Error al verificar el token FCM" });
    }
});

app.post('/saveUserToken', jsonParser, async (req, res) => {
    const { userId, token } = req.body;
    try {
        const response = await notion.databases.query({
            database_id: fcmDB,
            filter: {
                property: "Empleado",
                relation: {
                    contains: userId,
                }
            }
        });

        if (response.results.length === 0) {
            const newResponse = await notion.pages.create({
                parent: { database_id: fcmDB },
                properties: {
                    Empleado: {
                        relation: [{ id: userId }],
                    },
                    Token: {
                        title: [{
                            text: { content: token }
                        }],
                    },
                },
            });
            return res.status(200).send({ message: "Token guardado exitosamente" });
        } else {
            res.status(200).send({ message: "Token ya existe" });
        }
    } catch (error) {
        console.error("Error al guardar el token FCM:", error);
        res.status(500).json({ error: "Error al guardar el token FCM" });
    }
});


cron.schedule('0 9 * * 1-5', async () => {
    console.log('Verificando fichajes a las 9:00 AM...');

    try {
        const response = await notion.databases.query({
            database_id: fichajeDb,
            filter: {
                property: "Fecha_hora",
                date: {
                    after: new Date(),
                }
            }
        });

        const users = response.results;
        const userTokens = [];

        users.forEach(user => {
            const userToken = getUserToken(user);
            if (!userToken) return;

            if (hasNotClockedIn(user)) {
                userTokens.push(userToken);
            }
        });

        sendReminderNotification(userTokens);

    } catch (error) {
        console.error('Error al verificar fichajes:', error);
    }
});


app.get('/GetLocations', async (req, res) => {
    try {
        const response = await notion.databases.query({
            database_id: placesDB,
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ]
        });

        res.send(response);
        const { results } = response;
    } catch (error) {
        console.log(error);
    }
});

app.post('/PostLocation', jsonParser, async (req, res) => {
    const { Nombre, Longitud, Latitud } = req.body;
    try {
        const response = await notion.pages.create({
            parent: {
                database_id: placesDB,
            },
            properties: {
                Longitud: {
                    number: Longitud
                },
                Latitud: {
                    number: Latitud
                },
                Nombre: {
                    title: [{
                        text: {
                            content: Nombre
                        }
                    }
                    ]
                },
            },
        });
        res.send(response);
    } catch (error) {
        console.log(error);
    }
});

app.delete('/DeleteLocation/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const response = await notion.pages.update({
            page_id: id,
            archived: true,
        });
        if (response) {
            return res.status(200).send({ message: 'Localización archivada correctamente' });
        } else {
            return res.status(400).send({ message: 'Error al archivar la localización' });
        }
    } catch (error) {
        console.error('Error al hacer la solicitud a Notion:', error);
        return res.status(500).send({ message: 'Error al eliminar la localización', error });
    }
});

app.put("/UpdateLocation/:id", async (req, res) => {
    const { id } = req.params;
    const { Nombre } = req.body;

    try {
        const response = await notion.pages.update(
            {
                page_id: id,
                properties: {
                    Nombre: { title: [{ text: { content: Nombre } }] }
                },
            },
        );
    } catch (error) {
        console.error("Error actualizando localización:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log('server listening on port 8000!');
});