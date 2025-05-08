const { CronJob } = require('cron');
const { notion, db } = require('../utils/notion');
const { fcm } = require('../firebase');
const dayjs = require('dayjs');


const job = new CronJob('20 09 * * 1-5', async () => {
    console.log('⏰ Ejecutando recordatorio diario de fichajes…');
    const hoy = dayjs().tz('Atlantic/Canary').format('YYYY-MM-DD');

    try {
        const signings = await notion.databases.query({
            database_id: db.fichajeDb,
            filter: { property: 'Fecha_hora', date: { equals: hoy } }
        });
        const fichados = new Set(signings.results
            .flatMap(p => p.properties.Empleado.relation.map(r => r.id)));

        const tokensPages = await notion.databases.query({
            database_id: db.fcmDB
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

job.start();