// server/index.js (Versión para despliegue en línea con Firebase Firestore)

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const XLSX = require('xlsx'); // Para generar el Excel en memoria
const admin = require('firebase-admin'); // Importa Firebase Admin SDK

// *******************************************************************
// *** CONFIGURACIÓN DE FIREBASE (¡IMPORTANTE!) ***
// *******************************************************************

// Leer las credenciales del servicio de Firebase desde una variable de entorno.
// Render.com inyectará el contenido JSON de la clave de servicio aquí.
// Asegúrate de que la variable de entorno en Render.com se llame GOOGLE_APPLICATION_CREDENTIALS_JSON
let serviceAccount;
try {
  // Intentar parsear el JSON de la variable de entorno
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
} catch (e) {
  console.error("Error al parsear la variable de entorno GOOGLE_APPLICATION_CREDENTIALS_JSON.");
  console.error("Asegúrate de que contenga un JSON válido y esté configurada en Render.com.");
  console.error("Detalles del error:", e.message);
  // En un entorno de producción, aquí podrías querer salir del proceso o manejar el error de forma más robusta.
  // Para pruebas locales sin variables de entorno, podrías descomentar la siguiente línea
  // y asegurarte de tener el archivo JSON en la misma carpeta:
  // serviceAccount = require('./firebase-service-account.json');
}

// Inicializa Firebase Admin SDK con las credenciales obtenidas
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Obtén una referencia a la base de datos Firestore
const db = admin.firestore();

// *******************************************************************

const app = express();
const PORT = process.env.PORT || 5000; // Puerto para el servidor (Render.com usará su propio puerto)

// Middlewares
app.use(cors()); // Permite solicitudes desde diferentes orígenes (tu frontend en GitHub Pages)
app.use(bodyParser.json()); // Para parsear el cuerpo de las solicitudes JSON

// Definir los encabezados de las columnas para el archivo Excel
const EXCEL_HEADERS = [
    'First Name', 'Last Name', 'Favorite Sport', 'Gender',
    'Departamento Residente', '21 or Older', 'Car: Vado',
    'Car: Chrysler', 'Car: Toyota', 'Car: Nissan'
];

// Ruta de prueba para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.send('¡Servidor Node.js con Express y Firebase funcionando en línea!');
});

// Ruta para guardar los datos del formulario en Firestore y descargar el Excel
app.post('/guardar-y-descargar-excel', async (req, res) => {
    const formData = req.body;
    console.log('\n--- Solicitud de guardado recibida ---');
    console.log('Datos del formulario:', formData);

    try {
        const collectionRef = db.collection('formularios'); // Nombre de tu colección en Firestore

        // Criterio de unicidad: nombre, apellido, departamentoResidente
        // Normalizar los valores para la búsqueda (todo en minúsculas y sin espacios extra)
        const normalizedFirstName = formData.nombre ? formData.nombre.trim().toLowerCase() : '';
        const normalizedLastName = formData.apellido ? formData.apellido.trim().toLowerCase() : '';
        const normalizedDepartamento = formData.departamentoResidente ? formData.departamentoResidente.trim().toLowerCase() : '';

        // Buscar si ya existe un documento con estos criterios
        const querySnapshot = await collectionRef
            .where('nombreNormalizado', '==', normalizedFirstName)
            .where('apellidoNormalizado', '==', normalizedLastName)
            .where('departamentoResidenteNormalizado', '==', normalizedDepartamento)
            .limit(1) // Solo necesitamos encontrar uno si existe
            .get();

        let docRef;
        if (!querySnapshot.empty) {
            // Si se encuentra un duplicado, actualizar el documento existente
            docRef = querySnapshot.docs[0].ref;
            await docRef.update({
                ...formData, // Actualiza todos los campos del formulario
                nombreNormalizado: normalizedFirstName, // Mantener normalizados para futuras búsquedas
                apellidoNormalizado: normalizedLastName,
                departamentoResidenteNormalizado: normalizedDepartamento,
                timestamp: admin.firestore.FieldValue.serverTimestamp() // Actualizar la marca de tiempo
            });
            console.log('Documento existente actualizado en Firestore.');
        } else {
            // Si no es un duplicado, añadir un nuevo documento
            docRef = await collectionRef.add({
                ...formData, // Añade todos los campos del formulario
                nombreNormalizado: normalizedFirstName, // Guardar versión normalizada para búsquedas
                apellidoNormalizado: normalizedLastName,
                departamentoResidenteNormalizado: normalizedDepartamento,
                timestamp: admin.firestore.FieldValue.serverTimestamp() // Añadir la marca de tiempo de creación
            });
            console.log('Nuevo documento añadido a Firestore con ID:', docRef.id);
        }

        // *******************************************************************
        // *** Lógica para LEER TODOS los datos de Firestore y GENERAR el Excel ***
        // *******************************************************************

        // Obtener todos los documentos de la colección, ordenados por la marca de tiempo
        const allDocsSnapshot = await collectionRef.orderBy('timestamp', 'asc').get();
        const allData = [];
        allDocsSnapshot.forEach(doc => {
            const data = doc.data();
            // Mapear los datos del documento de Firestore a un formato de fila para Excel (array de valores)
            allData.push([
                data.nombre || '', // Usar '' si el campo no existe para evitar 'undefined' en Excel
                data.apellido || '',
                data.deporteFavorito || '',
                data.genero || '',
                data.departamentoResidente || '',
                data.mas21Anos ? 'Sí' : 'No', // Convertir booleano a 'Sí'/'No'
                data.modelosCoches?.vado ? 'X' : '', // Marcar 'X' si el coche está seleccionado
                data.modelosCoches?.chrysler ? 'X' : '',
                data.modelosCoches?.toyota ? 'X' : '',
                data.modelosCoches?.nissan ? 'X' : ''
            ]);
        });

        // Crear la hoja de trabajo de Excel con los encabezados y todos los datos
        const ws = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...allData]);
        const wb = XLSX.utils.book_new(); // Crear un nuevo libro de trabajo
        XLSX.utils.book_append_sheet(wb, ws, 'Datos del Formulario'); // Añadir la hoja al libro

        // Generar el buffer del archivo Excel en formato .xlsx
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        // Enviar el archivo Excel como respuesta para que el navegador lo descargue
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=datos_formulario_actualizado.xlsx');
        res.send(excelBuffer);
        console.log('Excel actualizado generado y enviado para descarga.');

    } catch (error) {
        console.error('Error al procesar la solicitud:', error);
        // Enviar una respuesta de error al frontend
        res.status(500).json({ message: 'Error al guardar los datos o generar el Excel. Por favor, inténtalo de nuevo más tarde.' });
    }
});

// ************ INICIO DEL SERVIDOR ************

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  console.log('Este servidor está configurado para conectarse a Firebase Firestore.');
  console.log('Asegúrate de que la variable de entorno GOOGLE_APPLICATION_CREDENTIALS_JSON esté configurada en tu entorno de despliegue (ej. Render.com).');
});
