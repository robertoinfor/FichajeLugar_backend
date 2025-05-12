const cron = require('node-cron');
const { notion, db } = require('../utils/notion');

// El primer día de cada mes almacena los fichajes en el histórico
cron.schedule('00 0 1 * *', async () => {
    console.log('Iniciando proceso de archivado mensual de fichajes...');
    try {
        const response = await notion.databases.query({
            database_id: db.fichajeDb,
        });

        const fichajesMensuales = response.results;
        console.log(`Se encontraron ${fichajesMensuales.length} fichajes del mes anterior.`);

        for (const fichaje of fichajesMensuales) {
            const fechaOriginal = fichaje.properties.Fecha_hora.date.start;
            const newProperties = {
                Fecha_hora: { date: { start: fechaOriginal } },
                Empleado: fichaje.properties.Empleado,
                Tipo: fichaje.properties.Tipo,
                Id: fichaje.properties.Id,
                Localizacion: fichaje.properties.Localizacion
            };

            await notion.pages.create({
                parent: { database_id: db.historicDB },
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