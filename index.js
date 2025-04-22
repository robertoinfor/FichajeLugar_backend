const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const port = process.env.PORT || 8000;
const Crypto = require('crypto-js');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');
require('dotenv').config();
const { admin, fcm } = require('./firebase');


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

app.get('/GetSignings', async (req, res) => {
    try {
        const results = await getFromDatabase(
            fichajeDb,
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
                property: "Token",
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

app.get('/GetTokensFCM', async (req, res) => {
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

app.get('/GetTokens', async (req, res) => {
    try {
        const results = await getFromDatabase(
            tokenDB,
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
    const Id = Crypto.lib.WordArray.random(8).toString();
    const { Empleado } = req.body;
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
                Token: {
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
        res.status(200).json({ tokenId: response.id });
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

async function getTokenFromDB(token, empleado) {
    if (token == "") { return null }
    const response = await notion.databases.query({
        database_id: tokenDB,
        filter: {
            property: "Token",
            title: { equals: token },
        }
    });
    return response.results[0];
}

app.post('/VerifyToken', async (req, res) => {
    const { token, empleado } = req.body;
    try {
        const tokenRecord = await getTokenFromDB(token, empleado);
        if (!tokenRecord) {
            return res.status(404).json({ message: "Token no encontrado" });
        }
        const generado = new Date(tokenRecord.properties.Generado.date.start);
        const ahora = new Date();
        const diffInMinutes = (ahora - generado) / (1000 * 60);
        if (diffInMinutes > 15 && generado != "") {
            return res.status(401).json({ message: "El token ha expirado" });
        }
        return res.status(200).json({ message: "Token válido", tokenRecord });
    } catch (error) {
        console.error("Error verificando token:", error);
        return res.status(500).json({ message: "Error en el servidor", error: error.message });
    }
});

app.delete('/DeleteToken/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const response = await notion.pages.update({
            page_id: id,
            archived: true,
        });
        if (response) {
            return res.status(200).send({ message: 'Token eliminado correctamente' });
        } else {
            return res.status(400).send({ message: 'Error al archivar el token' });
        }
    } catch (error) {
        console.error('Error al hacer la solicitud a Notion:', error);
        return res.status(500).send({ message: 'Error al eliminar el token', error });
    }
});

app.post('/sendNotification', async (req, res) => {
    const { userId, title, body, data = {} } = req.body;
    if (!userId || !title || !body) {
        return res.status(400).json({ error: 'userId, title y body son requeridos' });
    }

    try {
        const query = await notion.databases.query({
            database_id: fcmDB,
            filter: {
                property: 'Empleado',
                relation: { contains: userId }
            }
        });
        if (!query.results.length) {
            return res.status(404).json({ error: 'No se encontró token para ese usuario' });
        }
        const token = query.results[0].properties.Token.title[0].plain_text;

        const message = {
            token,
            notification: { title, body },
            data
        };
        const response = await fcm.send(message);
        return res.json({ message: 'Notificación enviada', id: response });
    } catch (error) {
        console.error('Error POST /sendNotification:', error);
        return res.status(500).json({ error: error.message });
    }
});

app.get('/fcm/token/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const query = await notion.databases.query({
            database_id: fcmDB,
            filter: {
                property: 'Empleado',
                relation: { contains: userId }
            }
        });
        if (!query.results.length) {
            return res.json({ token: null });
        }
        const page = query.results[0];
        const token = page.properties.Token.title[0]?.plain_text || null;
        return res.json({ token, pageId: page.id });
    } catch (error) {
        console.error('Error GET /fcm/token:', error);
        return res.status(500).json({ error: error.message });
    }
});

app.post('/fcm/token', async (req, res) => {
    const { userId, token } = req.body;
    if (!userId || !token) {
        return res.status(400).json({ error: 'userId y token requeridos' });
    }

    try {
        const query = await notion.databases.query({
            database_id: fcmDB,
            filter: {
                property: 'Empleado',
                relation: { contains: userId }
            }
        });

        if (query.results.length === 0) {
            await notion.pages.create({
                parent: { database_id: fcmDB },
                properties: {
                    Empleado: { relation: [{ id: userId }] },
                    Token: { title: [{ text: { content: token } }] }
                }
            });
            return res.status(201).json({ message: 'Token creado' });
        } else {
            const pageId = query.results[0].id;
            await notion.pages.update({
                page_id: pageId,
                properties: {
                    Token: { title: [{ text: { content: token } }] },
                    Editado: { date: { start: new Date() } }
                }
            });
            return res.json({ message: 'Token actualizado' });
        }
    } catch (error) {
        console.error('Error POST /fcm/token:', error);
        return res.status(500).json({ error: error.message });
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

app.put('/ChangeStateLocation/:id', async (req, res) => {
    const { id } = req.params;
    const { Estado } = req.body;
    try {
        const response = await notion.pages.update({
            page_id: id,
            properties: {
                Estado: { status: { name: Estado } }
            },
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

cron.schedule('15 09 * * 1-5', async () => {
    console.log('⏰ Ejecutando recordatorio diario de fichajes…');
    const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    try {
        const signings = await notion.databases.query({
            database_id: fichajeDb,
            filter: { property: 'Fecha_hora', date: { equals: hoy } }
        });
        const fichados = new Set(signings.results
            .flatMap(p => p.properties.Empleado.relation.map(r => r.id)));

        const tokensPages = await notion.databases.query({
            database_id: fcmDB
        });
        const usuariosConToken = tokensPages.results.map(p => ({
            userId: p.properties.Empleado.relation[0].id,
            token: p.properties.Token.title[0].plain_text
        }));

        for (const { userId, token } of usuariosConToken) {
            if (!fichados.has(userId)) {
                await fcm.send({
                    token,
                    notification: {
                        title: '⏰ ¡No olvides fichar!',
                        body: 'Aún no has fichado hoy. Regístrate al entrar.'
                    },
                    data: { type: 'recordatorio_fichaje' }
                });
            }
        }
        console.log('Recordatorios enviados.');
    } catch (e) {
        console.error('Error en cron de recordatorio:', e);
    }
});

app.listen(port, () => {
    console.log('server listening on port 8000!');
});