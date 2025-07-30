// Server-online/index.js

require('dotenv').config(); // Asegúrate de que esta línea esté al principio para leer .env localmente

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin'); // Importa Firebase Admin SDK
const XLSX = require('xlsx'); // Importa la librería xlsx

const app = express();
const PORT = process.env.PORT || 10000; // Usa el puerto de la variable de entorno o 10000 por defecto

// Inicializa Firebase Admin SDK
// Render.com proporcionará GOOGLE_APPLICATION_CREDENTIALS_JSON como variable de entorno
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin SDK inicializado correctamente desde la variable de entorno.');
    } catch (error) {
        console.error('Error al parsear GOOGLE_APPLICATION_CREDENTIALS_JSON:', error);
        process.exit(1); // Sale si las credenciales son incorrectas
    }
} else {
    console.error('La variable de entorno GOOGLE_APPLICATION_CREDENTIALS_JSON no está definida.');
    console.error('Asegúrate de configurar las credenciales de Firebase en Render.com o en un archivo .env local.');
    process.exit(1); // Sale si las credenciales no están configuradas
}

const db = admin.firestore(); // Obtiene la instancia de Firestore

// Middlewares
app.use(bodyParser.json());
// Configuración CORS más específica para producción
app.use(cors({
    origin: ['http://localhost:3000', 'https://aljulio.github.io'], // Asegúrate que esta URL sea correcta para tu frontend
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));

// ***** RUTA ÚNICA: Guardar datos en Firestore (actualizar o agregar) *****
// Este endpoint ahora SOLO guarda datos, NO descarga el Excel automáticamente.
app.post('/guardar-y-descargar-excel', async (req, res) => {
    try {
        const formData = req.body;
        console.log('\n--- Solicitud de guardado recibida ---');
        console.log('Datos del formulario:', formData);

        // Limpia y normaliza los campos clave para la búsqueda de duplicados
        const normalizedNombre = formData.nombre ? formData.nombre.trim().toLowerCase() : '';
        const normalizedApellido = formData.apellido ? formData.apellido.trim().toLowerCase() : '';
        const normalizedDepartamento = formData.departamentoResidente ? formData.departamentoResidente.trim().toLowerCase() : '';

        let docIdToUpdate = null;

        // 1. Buscar duplicados en Firestore
        const querySnapshot = await db.collection('formularios')
            .where('nombre', '==', formData.nombre.trim())
            .where('apellido', '==', formData.apellido.trim())
            .where('departamentoResidente', '==', formData.departamentoResidente.trim())
            .limit(1)
            .get();

        if (!querySnapshot.empty) {
            docIdToUpdate = querySnapshot.docs[0].id;
            console.log(`[DEBUG] Duplicado encontrado en Firestore con ID: ${docIdToUpdate}. Actualizando registro existente.`);
        } else {
            console.log('[DEBUG] No se encontró duplicado en Firestore. Se agregará un nuevo registro.');
        }

        // Agrega una marca de tiempo de la última actualización
        const dataToSave = {
            ...formData,
            timestamp: admin.firestore.FieldValue.serverTimestamp(), // Marca de tiempo de la última modificación
            normalizedNombre: normalizedNombre,
            normalizedApellido: normalizedApellido,
            normalizedDepartamento: normalizedDepartamento
        };

        if (docIdToUpdate) {
            await db.collection('formularios').doc(docIdToUpdate).update(dataToSave);
            console.log('Documento actualizado con ID:', docIdToUpdate);
        } else {
            const docRef = await db.collection('formularios').add(dataToSave);
            console.log('Nuevo documento agregado con ID:', docRef.id);
        }

        // ¡IMPORTANTE! Ahora solo enviamos una respuesta de éxito, NO el archivo Excel.
        res.status(200).json({ message: 'Datos guardados en Firestore con éxito.' });

    } catch (error) {
        console.error('Error al guardar datos en Firestore:', error);
        res.status(500).json({ message: 'Error al procesar la solicitud de guardado.', error: error.message });
    }
});

// ***** NUEVO ENDPOINT: Descargar Excel con todos los datos de Firestore *****
app.get('/descargar-excel', async (req, res) => {
    try {
        console.log('\n--- Solicitud de descarga de Excel recibida ---');

        // 1. Obtener todos los datos de Firestore
        const snapshot = await db.collection('formularios').orderBy('timestamp', 'asc').get();
        const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            // Convierte serverTimestamp a una cadena legible si existe
            if (docData.timestamp && typeof docData.timestamp.toDate === 'function') {
                docData.timestamp = docData.timestamp.toDate().toLocaleString(); // Formatea la fecha para Excel
            }
            // Elimina los campos normalizados si no quieres que aparezcan en el Excel final
            delete docData.normalizedNombre;
            delete docData.normalizedApellido;
            delete docData.normalizedDepartamento;
            return docData;
        });

        if (data.length === 0) {
            return res.status(404).json({ message: 'No hay registros en la base de datos para descargar.' });
        }

        // 2. Formatear los datos para el Excel
        const formattedData = data.map(row => ({
            'First Name': row.nombre || '',
            'Last Name': row.apellido || '',
            'Favorite Sport': row.deporteFavorito || '',
            'Gender': row.genero || '',
            'Departamento Residente': row.departamentoResidente || '',
            '21 or Older': row.mas21Anos ? 'Sí' : 'No',
            'Car: Vado': row.modelosCoches && row.modelosCoches.vado ? 'X' : '',
            'Car: Chrysler': row.modelosCoches && row.modelosCoches.chrysler ? 'X' : '',
            'Car: Toyota': row.modelosCoches && row.modelosCoches.toyota ? 'X' : '',
            'Car: Nissan': row.modelosCoches && row.modelosCoches.nissan ? 'X' : '',
            'Last Updated': row.timestamp || '' // Agrega la marca de tiempo de actualización
        }));

        // 3. Generar el archivo Excel en memoria
        const ws = XLSX.utils.json_to_sheet(formattedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'RegistrosFormulario');

        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        // 4. Enviar el archivo Excel como respuesta
        res.setHeader('Content-Disposition', 'attachment; filename=datos_formulario_actualizado.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);

        console.log('Archivo Excel generado desde Firestore y enviado para descarga.');

    } catch (error) {
        console.error('Error al generar o descargar el Excel desde Firestore:', error);
        res.status(500).json({ message: 'Error al procesar la solicitud de descarga.', error: error.message });
    }
});


// ***** RUTA DE BIENVENIDA (Opcional) *****
app.get('/', (req, res) => {
    res.send('¡Servidor Node.js con Express y Firebase funcionando en línea! Usa /guardar-y-descargar-excel para guardar y /descargar-excel para obtener el Excel.');
});

// ***** INICIO DEL SERVIDOR *****
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
    console.log('Este servidor está configurado para conectarse a Firebase Firestore.');
    console.log('Asegúrate de que la variable de entorno GOOGLE_APPLICATION_CREDENTIALS_JSON esté configurada.');
});