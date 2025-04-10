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
const stream = require('stream');
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
const historicDB = process.env.HISTORIC_KEY;

const storage = multer.memoryStorage();
const upload = multer({ storage });
const api_drive = require('./API_DRIVE.json')

const SCOPE = ['https://www.googleapis.com/auth/drive'];

const Holidays = require('date-holidays');

app.get('/holidays/:year', (req, res) => {
    const year = parseInt(req.params.year, 10);
    const hd = new Holidays('ES', 'CN', '35');
    const holidays = hd.getHolidays(year);
    const filteredHolidays = holidays.filter(f => f.type === 'public');
    res.json(filteredHolidays);
});

async function authorize() {
    const jwtClient = new google.auth.JWT(
        api_drive.client_email,
        null,
        api_drive.private_key,
        SCOPE
    );
    await jwtClient.authorize();
    return jwtClient;
}

async function uploadFile(authClient, image) {
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
        }, function (error, file) {
            if (error) {
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
    const Nombre_usuario = req.body["Nombre de usuario"];
    const Nombre_completo = req.body["Nombre completo"];
    const { Pwd, Email, Rol, Fecha_alta, Horas, Foto } = req.body;
    try {
        const hash = Crypto.AES.encrypt(Pwd, key).toString();
        const response = await notion.pages.create({
            parent: { database_id: usuariosDb },
            properties: {
                "Nombre de usuario": {
                    title: [
                        {
                            type: "text",
                            text: { content: Nombre_usuario }
                        }
                    ]
                },
                "Nombre completo": {
                    rich_text: [
                        {
                            type: "text",
                            text: { content: Nombre_completo }
                        }
                    ]
                },
                "Pwd": {
                    rich_text: [
                        {
                            type: "text",
                            text: { content: hash }
                        }
                    ]
                },
                "Email": {
                    email: Email
                },
                "Rol": {
                    select: {
                        name: Rol
                    }
                },
                "Fecha_alta": {
                    date: {
                        start: Fecha_alta
                    }
                },
                "Horas": {
                    number: Horas
                },
                "Foto": Foto,
                "Estado": {
                    status: {
                        name: "Activo"
                    }
                },
                "Conexion": {
                    status: {
                        name: "Desconectado"
                    }
                }
            }
        });

        res.send(response);
    } catch (error) {
        console.log(error);
    }
});

async function getFromDatabase(databaseId, filter = null, sorts = null) {
    const query = {
        database_id: databaseId,
    };

    if (filter) query.filter = filter;
    if (sorts) query.sorts = sorts;

    const response = await notion.databases.query(query);
    return response.results;
}

app.get('/GetUsers', async (req, res) => {
    try {
        const results = await getFromDatabase(
            usuariosDb,
            null,
            [{ timestamp: 'created_time', direction: 'descending' }]
        );
        res.send({ results });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
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
                        property: "Nombre de usuario",
                        title: { equals: login }
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
            nombre: usuario.properties["Nombre de usuario"].title[0]?.plain_text,
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


app.put('/UpdateUserState/:id', async (req, res) => {
    const { id } = req.params;
    const { Estado } = req.body;
    try {
        const response = await notion.pages.update(
            {
                page_id: id,
                properties: {
                    Estado: { status: { name: Estado } }
                },
            },
        )
    } catch (error) {
        console.error('Error al hacer la solicitud a Notion:', error);
        return res.status(500).send({ message: 'Error al eliminar el usuario', error });
    }
});

app.put("/UpdateUser/:id", async (req, res) => {
    const { id } = req.params;
    const Nombre_usuario = req.body["Nombre de usuario"];
    const Nombre_completo = req.body["Nombre completo"];
    const { Pwd, Email, Rol, Fecha_alta, Horas, Foto } = req.body;

    try {
        const hash = Crypto.AES.encrypt(Pwd, key).toString();
        const response = await notion.pages.update(
            {
                page_id: id,
                properties: {
                    "Nombre de usuario": { title: [{ text: { content: Nombre_usuario } }] },
                    Email: { email: Email },
                    Pwd: { rich_text: [{ text: { content: hash }, },], },
                    Rol: { select: { name: Rol } },
                    Fecha_alta: { date: { start: Fecha_alta } },
                    Horas: { number: Horas },
                    Foto: Foto,
                    "Nombre completo": { rich_text: [{ text: { content: Nombre_completo } }] }
                },
            },
        );
        return res.status(200).json({ message: 'Fichaje actualizado', data: response });
    } catch (error) {
        console.error("Error actualizando usuario:", error);
        return res.status(500).json({ error: error.message });
    }
});

app.put("/UpdateUserLog/:id", async (req, res) => {
    const { id } = req.params;
    const { Conexion } = req.body;
    try {
        const response = await notion.pages.update(
            {
                page_id: id,
                properties: {
                    Conexion: { status: { name: Conexion } }
                },
            },
        );
        return res.status(200).json({ message: 'Usuario conectado', data: response });
    } catch (error) {
        console.error("Error actualizando usuario:", error);
        return res.status(500).json({ error: error.message });
    }
});

app.get('/GetUserByName/:name', async (req, res) => {
    try {
        const results = await getFromDatabase(
            usuariosDb,
            { property: "Nombre de usuario", title: { equals: req.params.name } },
            [{ timestamp: 'created_time', direction: 'descending' }]
        );
        res.send({ results });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
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
        const decryptedPassword = await getDecryptedPasswordByUserId(userId);

        res.status(200).json({ password: decryptedPassword });
    } catch (error) {
        console.error("Error al obtener la contraseña:", error);
        res.status(500).json({ message: "Error en el servidor", error });
    }
});


async function getDecryptedPasswordByUserId(userId) {
    const userResponse = await notion.pages.retrieve({ page_id: userId });
    const storedPassword = userResponse.properties.Pwd.rich_text[0]?.text.content;

    const bytes = Crypto.AES.decrypt(storedPassword, key);
    const decryptedPassword = bytes.toString(Crypto.enc.Utf8);
    return decryptedPassword;
}


app.post('/GetDecryptedPasswordByUserId', jsonParser, async (req, res) => {
    const { userId } = req.body;
    try {
        const decryptedPassword = await getDecryptedPasswordByUserId(userId);
        res.status(200).json({ password: decryptedPassword });
    } catch (error) {
        console.error("Error al desencriptar contraseña por userId:", error);
        res.status(500).json({ message: "Error en el servidor", error });
    }
});

app.get('/GetSigningUser/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const results = await getFromDatabase(
            fichajeDb,
            { property: "Empleado", relation: { contains: id } },
            [{ timestamp: 'created_time', direction: 'descending' }]
        );
        const results2 = await getFromDatabase(
            historicDB,
            { property: "Empleado", relation: { contains: id } },
            [{ timestamp: 'created_time', direction: 'descending' }]
        );
        const signings = [...results, ...results2];
        res.send({ signings });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
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
    let id = `${new Date().toLocaleString('es-ES', { month: 'long' }).charAt(0).toUpperCase() + new Date().toLocaleString('es-ES', { month: 'long' }).slice(1)} ${new Date().getFullYear()}`;
    const { Empleado, Tipo, Fecha_hora, Localizacion } = req.body;
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
                Localizacion: { relation: [{ id: Localizacion }] },
                Id: {
                    title: [{
                        text: {
                            content: id
                        }
                    }
                    ]
                }
            },
        });
        res.send(response);
    } catch (error) {
        console.log(error);
    }
});

app.put("/UpdateSigning/:id", async (req, res) => {
    const { id } = req.params;
    const { Empleado, Tipo, Fecha_hora, fecha, hora, Localizacion } = req.body;

    try {
        const response = await notion.pages.update(
            {
                page_id: id,
                properties: {
                    Empleado: { relation: [{ id: Empleado }] },
                    Tipo: { select: { name: Tipo } },
                    Fecha_hora: { date: { start: Fecha_hora }, },
                    Localizacion: { relation: [{ id: Localizacion }] }
                },
            },
        );
        return res.status(200).json({ message: 'Fichaje actualizado', data: response });
    } catch (error) {
        console.error("Error actualizando usuario:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/DeleteSigning/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const response = await notion.pages.update({
            page_id: id,
            archived: true,
        });
        if (response) {
            return res.status(200).send({ message: 'Fichaje archivado correctamente' });
        } else {
            return res.status(400).send({ message: 'Error al archivar el fichaje' });
        }
    } catch (error) {
        console.error('Error al hacer la solicitud a Notion:', error);
        return res.status(500).send({ message: 'Error al eliminar el fichaje', error });
    }
});

app.get('/GetTokens', async (req, res) => {
    try {
        const results = await getFromDatabase(
            fcmDB,
            null,
            [{ timestamp: 'created_time', direction: 'descending' }]
        );
        res.send({ results });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
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

async function getTokenFromDB(token) {
    const response = await notion.databases.query({
        database_id: tokenDB,
        filter: {
            property: "Id",
            title: { equals: token }
        }
    });
    return response.results[0];
}

app.post('/VerifyToken', async (req, res) => {
    const { token } = req.body;
    try {
        const tokenRecord = await getTokenFromDB(token);
        if (!tokenRecord) {
            return res.status(404).json({ message: "Token no encontrado" });
        }

        const generado = new Date(tokenRecord.properties.Generado.date.start);
        const ahora = new Date();
        const diffInMinutes = (ahora - generado) / (1000 * 60);

        if (diffInMinutes > 15) {
            return res.status(401).json({ message: "El token ha expirado" });
        }

        return res.status(200).json({ message: "Token válido", tokenRecord });
    } catch (error) {
        console.error("Error verificando token:", error);
        return res.status(500).json({ message: "Error en el servidor", error: error.message });
    }
});

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

        // sendReminderNotification(userTokens);

    } catch (error) {
        console.error('Error al verificar fichajes:', error);
    }
});


app.get('/GetLocations', async (req, res) => {
    try {
        const results = await getFromDatabase(
            placesDB,
            null,
            [{ timestamp: 'created_time', direction: 'descending' }]
        );
        res.send({ results });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
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


async function getAllSigningsFromDB(databaseId) {
    let allResults = [];
    let cursor = undefined;
    do {
        const response = await notion.databases.query({
            database_id: databaseId,
            start_cursor: cursor,
        });
        allResults.push(...response.results);
        cursor = response.has_more ? response.next_cursor : null;
    } while (cursor);
    return allResults;
}

app.get('/GetAllSignings', async (req, res) => {
    try {
        const activeSignings = await getAllSigningsFromDB(fichajeDb);
        const archivedSignings = await getAllSigningsFromDB(historicDB);
        const allSignings = [...activeSignings, ...archivedSignings];
        res.status(200).json({ results: allSignings });
    } catch (error) {
        console.error("Error al obtener fichajes:", error);
        res.status(500).json({ message: "Error en el servidor", error: error.message });
    }
});

cron.schedule('0 0 1 * *', async () => {
    console.log('Iniciando proceso de archivado mensual de fichajes...');
    try {
        const now = new Date();
        const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);


        const response = await notion.databases.query({
            database_id: fichajeDb,
            filter: {
                and: [
                    {
                        property: "Fecha_hora",
                        date: {
                            after: firstDayPrevMonth
                        }
                    },
                    {
                        property: "Fecha_hora",
                        date: {
                            before: firstDayCurrentMonth
                        }
                    }
                ]
            }

        });

        const fichajesMensuales = response.results;
        console.log(`Se encontraron ${fichajesMensuales.length} fichajes del mes anterior.`);

        for (const fichaje of fichajesMensuales) {
            const fechaOriginal = fichaje.properties.Fecha_hora.date.start;
            const newProperties = {
                Fecha_hora: { date: { start: fechaOriginal } },
                Empleado: fichaje.properties.Empleado,
                Tipo: fichaje.properties.Tipo,
                Id: fichaje.properties.Id
            };

            await notion.pages.create({
                parent: { database_id: historicDB },
                properties: newProperties
            });

            await notion.pages.update({
                page_id: fichaje.id,
                archived: true
            });

            console.log(`Fichaje ${fichaje.id} archivado.`);
        }

        console.log('Proceso de archivado mensual completado.');
    } catch (error) {
        console.error('Error archivando fichajes mensuales:', error);
    }
});

app.listen(port, () => {
    console.log('server listening on port 8000!');
});