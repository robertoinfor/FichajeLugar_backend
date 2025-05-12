const { notion, db, getFromDatabase } = require('../utils/notion');

// Recojo el token FCM de un usuario
exports.getToken = async (req, res) => {
    const { userId } = req.params;
    try {
        const query = await notion.databases.query({
            database_id: db.fcmDB,
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
};

// Subo un token de un usuario
exports.postToken = async (req, res) => {
    const { userId, token } = req.body;
    if (!userId || !token) {
        return res.status(400).json({ error: 'userId y token requeridos' });
    }

    try {
        const query = await notion.databases.query({
            database_id: db.fcmDB,
            filter: {
                property: 'Empleado',
                relation: { contains: userId }
            }
        });

        if (query.results.length === 0) {
            await notion.pages.create({
                parent: { database_id: db.fcmDB },
                properties: {
                    Empleado: { relation: [{ id: userId }] },
                    Token: { title: [{ text: { content: token } }] },
                    Editado: { date: { start: new Date() } }
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
};

// Devuelve todos los tokens FCM
exports.getTokensFCM = async (req, res) => {
    try {
        const results = await getFromDatabase(
            db.fcmDB,
            null,
            [{ timestamp: 'created_time', direction: 'descending' }]
        );
        res.send({ results });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};

// Mando la notificación
exports.sendNotification = async (req, res) => {
    const { userId, title, body, data = {} } = req.body;
    if (!userId || !title || !body) {
        return res.status(400).json({ error: 'userId, title y body son requeridos' });
    }

    try {
        const query = await notion.databases.query({
            database_id: db.fcmDB,
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
};

// Borro un token FCM
exports.deleteTokenFCM = async (req, res) => {
    const { id } = req.params;
    try {
        const response = await notion.pages.update({
            page_id: id,
            archived: true,
        });
        if (response) {
            return res.status(200).send({ message: 'Token FCM archivado correctamente' });
        } else {
            return res.status(400).send({ message: 'Error al archivar el token FCM' });
        }
    } catch (error) {
        console.error('Error al hacer la solicitud a Notion:', error);
        return res.status(500).send({ message: 'Error al eliminar el token FCM', error });
    }
};