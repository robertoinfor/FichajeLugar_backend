const { notion, db, getFromDatabase } = require('../utils/notion');

exports.getSignings =  async (req, res) => {
    try {
        const results = await getFromDatabase(
            db.fichajeDb,
            null,
            [{ timestamp: 'created_time', direction: 'descending' }]
        );
        res.send({ results });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};

exports.getSigningsUser = async (req, res) => {
    const { id } = req.params;
    try {
        const results = await getFromDatabase(
            db.fichajeDb,
            { property: "Empleado", relation: { contains: id } },
            [{ timestamp: 'created_time', direction: 'descending' }]
        );
        const results2 = await getFromDatabase(
            db.historicDB,
            { property: "Empleado", relation: { contains: id } },
            [{ timestamp: 'created_time', direction: 'descending' }]
        );
        const signings = [...results, ...results2];
        res.send({ signings });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};

exports.getSigningbyId = async (req, res) => {
    const { id } = req.params;
    try {
        const response = await notion.pages.retrieve({
            page_id: id,
        });

        res.send(response);
    } catch (error) {
        console.log(error);
    }
};

exports.postSigning = async (req, res) => {
    let id = `${new Date().toLocaleString('es-ES', { month: 'long' }).charAt(0).toUpperCase() + new Date().toLocaleString('es-ES', { month: 'long' }).slice(1)} ${new Date().getFullYear()}`;
    const { Empleado, Tipo, Fecha_hora, Localizacion } = req.body;
    try {
        const response = await notion.pages.create({
            parent: {
                database_id: db.fichajeDb,
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
};

exports.updateSigning = async (req, res) => {
    const { id } = req.params;
    const { Empleado, Tipo, Fecha_hora, Localizacion } = req.body;
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
};

exports.deleteSigning = async (req, res) => {
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
};

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

exports.getAllSignings = async (req, res) => {
    try {
        const activeSignings = await getAllSigningsFromDB(db.fichajeDb);
        const archivedSignings = await getAllSigningsFromDB(db.historicDB);
        const allSignings = [...activeSignings, ...archivedSignings];
        res.status(200).json({ results: allSignings });
    } catch (error) {
        console.error("Error al obtener fichajes:", error);
        res.status(500).json({ message: "Error en el servidor", error: error.message });
    }
};