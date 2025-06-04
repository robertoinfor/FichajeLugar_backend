const { notion, db, getFromDatabase } = require('../utils/notion');

// Recojo las ubicaciones
exports.getLocations = async (req, res) => {
    try {
        const results = await getFromDatabase(
            db.placesDB,
            null,
            [{ timestamp: 'created_time', direction: 'descending' }]
        );
        res.send({ results });
    } catch (error) {
        console.error("Error en getLocations:", err.message || err);
        res.status(500).json({
            error: 'No se pudieron obtener las ubicaciones. Inténtalo más tarde.',
            details: err.message || err
        });
    }
};

// Subo una ubicación
exports.postLocation = async (req, res) => {
    const { Nombre, Longitud, Latitud } = req.body;
    try {
        const response = await notion.pages.create({
            parent: {
                database_id: db.placesDB,
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
                Estado: {
                    status: { name: "Activo" }
                }
            },
        });
        res.send(response);
    } catch (error) {
        console.log(error);
    }
};

// Cambia el estado de una ubicación para desactivarla
exports.changeStateLocation = async (req, res) => {
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
};

// Actualiza el nombre de una ubicación
exports.updateLocation = async (req, res) => {
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
        res.status(200).json({ message: "Localización actualizada correctamente", data: response });
    } catch (error) {
        console.error("Error actualizando localización:", error);
        res.status(500).json({ error: error.message });
    }
};