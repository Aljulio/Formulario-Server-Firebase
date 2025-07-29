// Server-online/index.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 10000; // Use port from environment variable or default to 10000

// Initialize Firebase Admin SDK
// Render.com will provide GOOGLE_APPLICATION_CREDENTIALS_JSON as an environment variable
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin SDK inicializado correctamente desde la variable de entorno.');
    } catch (error) {
        console.error('Error al parsear GOOGLE_APPLICATION_CREDENTIALS_JSON:', error);
        process.exit(1); // Exit if credentials are bad
    }
} else {
    console.error('La variable de entorno GOOGLE_APPLICATION_CREDENTIALS_JSON no está definida.');
    console.error('Asegúrate de configurar las credenciales de Firebase en Render.com.');
    process.exit(1); // Exit if credentials are not set
}

const db = admin.firestore();

// Middleware
app.use(bodyParser.json());
// Configuración CORS más específica para producción
app.use(cors({
    origin: ['http://localhost:3000', 'https://aljulio.github.io'], // <--- Asegúrate que esta URL sea correcta para tu frontend
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));


// ***** RUTA ÚNICA: Guardar datos en Firestore y descargar Excel *****
app.post('/guardar-y-descargar-excel', async (req, res) => {
    try {
        const formData = req.body;

        // Agrega una marca de tiempo a los datos
        formData.timestamp = admin.firestore.FieldValue.serverTimestamp();

        // Guarda los datos en Firestore
        const docRef = await db.collection('formularios').add(formData);
        console.log('Documento escrito con ID:', docRef.id);

        // --- Generar y enviar el Excel con TODOS los registros ---
        const snapshot = await db.collection('formularios').orderBy('timestamp', 'asc').get(); // Ordena por marca de tiempo
        const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            // Convierte serverTimestamp a una cadena legible si existe
            if (docData.timestamp && typeof docData.timestamp.toDate === 'function') {
                docData.timestamp = docData.timestamp.toDate().toLocaleString(); // Formatea la fecha para Excel
            }
            return docData;
        });

        if (data.length === 0) {
            // Si no hay datos, puedes enviar un mensaje de error o un Excel vacío
            return res.status(404).json({ message: 'No hay registros para descargar.' });
        }

        // Convierte valores booleanos a 'Sí'/'No' y los modelos de coche a una cadena para mejor legibilidad en Excel
        const formattedData = data.map(row => ({
            ...row,
            mas21Anos: row.mas21Anos ? 'Sí' : 'No',
            modelosCoches: Object.keys(row.modelosCoches || {}).filter(key => row.modelosCoches[key]).join(', ') || 'Ninguno'
        }));

        const ws = XLSX.utils.json_to_sheet(formattedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'RegistrosFormulario');

        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Disposition', 'attachment; filename=datos_formulario_actualizado.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);

        console.log('Datos guardados y archivo Excel actualizado enviado exitosamente.');

    } catch (error) {
        console.error('Error al guardar datos o generar Excel:', error);
        res.status(500).json({ message: 'Error al procesar la solicitud.', error: error.message });
    }
});

// ***** RUTA DE BIENVENIDA (Opcional) *****
app.get('/', (req, res) => {
    res.send('¡Servidor Node.js con Express y Firebase funcionando en línea! Usa /guardar-y-descargar-excel para guardar y obtener el Excel.');
});

// ***** INICIO DEL SERVIDOR *****
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
    console.log('Este servidor está configurado para conectarse a Firebase Firestore.');
    console.log('Asegúrate de que la variable de entorno GOOGLE_APPLICATION_CREDENTIALS_JSON esté configurada.');
});