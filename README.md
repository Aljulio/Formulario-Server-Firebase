# Formulario-Server-Firebase

Este repositorio contiene el código fuente del backend Node.js que sirve como API para la aplicación de formulario web. Está diseñado para interactuar con **Firebase Firestore** para el almacenamiento de datos y para generar y descargar archivos Excel dinámicamente.

Este backend está desplegado en [Render.com](https://render.com/) y se integra con el frontend de la aplicación `Formulario-` (si tienes un repositorio separado para el frontend, puedes añadir un enlace aquí).

## 🚀 Características Principales

* **API RESTful:** Proporciona un endpoint POST para recibir datos del formulario.
* **Base de Datos Firebase Firestore:** Almacena los datos enviados por el formulario en una colección de Firestore.
* **Lógica de "Upsert" (Actualizar o Insertar):**
    * Si un registro con el mismo **Nombre**, **Apellido** y **Departamento Residente** ya existe en Firestore, el backend **actualiza** los datos de ese registro existente.
    * Si no se encuentra una coincidencia, se **inserta** un nuevo registro en la base de datos.
    * Esta lógica de unicidad es insensible a mayúsculas/minúsculas y recorta espacios en blanco.
* **Generación de Excel Dinámica:** Después de guardar o actualizar los datos en Firestore, el servidor lee *todos* los registros actuales de la base de datos, los compila en un archivo Excel (`.xlsx`) y lo envía al cliente para su descarga inmediata.
* **Manejo de CORS:** Configurado para permitir solicitudes desde el frontend desplegado (GitHub Pages) y desde el entorno de desarrollo local (localhost).
* **Variables de Entorno:** Utiliza `dotenv` para la gestión segura de credenciales de Firebase en entornos locales.

## 🛠️ Tecnologías Utilizadas

* **Node.js:** Entorno de ejecución de JavaScript del lado del servidor.
* **Express.js:** Framework web para Node.js, utilizado para construir la API.
* **Firebase Admin SDK:** Permite al servidor interactuar con los servicios de Firebase (en este caso, Firestore).
* **`xlsx` (SheetJS):** Librería potente para leer, escribir y manipular archivos Excel.
* **`dotenv`:** Para cargar variables de entorno desde un archivo `.env` en desarrollo.
* **`body-parser`:** Middleware para analizar los cuerpos de las solicitudes entrantes en un middleware antes de los controladores.
* **`cors`:** Middleware para habilitar el Cross-Origin Resource Sharing (CORS).

## ⚙️ Configuración y Ejecución Local

Para ejecutar este servidor en tu máquina local:

1.  **Clonar el Repositorio:**
    ```bash
    git clone [https://github.com/Aljulio/Formulario-Server-Firebase.git](https://github.com/Aljulio/Formulario-Server-Firebase.git)
    cd Formulario-Server-Firebase
    ```

2.  **Instalar Dependencias:**
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno (Credenciales de Firebase):**
    Este servidor requiere credenciales de Firebase para conectarse a tu proyecto de Firestore.
    * Ve a tu Consola de Firebase: [https://console.firebase.google.com/](https://console.firebase.google.com/)
    * Selecciona tu proyecto (`formularioexcelonline`).
    * Ve a **"Configuración del proyecto"** (el icono de engranaje ⚙️ junto a "Descripción general del proyecto").
    * Haz clic en la pestaña **"Cuentas de servicio"**.
    * Haz clic en **"Generar nueva clave privada"**. Esto descargará un archivo JSON con tus credenciales.
    * **Abre ese archivo JSON** descargado con un editor de texto.
    * **Copia todo el contenido de ese archivo JSON en una sola línea**, asegurándote de escapar cualquier comilla doble interna si es necesario (Render.com lo maneja automáticamente, pero para un `.env` local, es clave).

    * En la raíz de este repositorio (`Formulario-Server-Firebase`), crea un archivo llamado `.env` y añade la siguiente línea:

        ```
        GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type": "service_account","project_id": "TU_PROJECT_ID","private_key_id": "TU_PRIVATE_KEY_ID","private_key": "-----BEGIN PRIVATE KEY-----\nTU_PRIVATE_KEY_MULTILINE\n-----END PRIVATE KEY-----\n","client_email": "TU_CLIENT_EMAIL","client_id": "TU_CLIENT_ID","auth_uri": "[https://accounts.google.com/o/oauth2/auth](https://accounts.google.com/o/oauth2/auth)","token_uri": "[https://oauth2.googleapis.com/token](https://oauth2.googleapis.com/token)","auth_provider_x509_cert_url": "[https://www.googleapis.com/oauth2/v1/certs](https://www.googleapis.com/oauth2/v1/certs)","client_x509_cert_url": "[https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx.iam.gserviceaccount.com](https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx.iam.gserviceaccount.com)","universe_domain": "googleapis.com"}'
        ```
        **Reemplaza los valores entre comillas y el contenido de `private_key` con los datos de tu archivo JSON.** Asegúrate de que `private_key` esté en una sola línea, con `\n` para los saltos de línea.

4.  **Ejecutar el Servidor:**
    ```bash
    node index.js
    ```
    El servidor se iniciará y escuchará en el puerto `10000` (o el que se configure en las variables de entorno).

## 🌐 Despliegue

Este backend está configurado para un despliegue continuo en [Render.com](https://render.com/).

* **Servicio:** `formulario-firebase-api-prod`
* **Conexión a GitHub:** Está enlazado a este repositorio de GitHub (`https://github.com/Aljulio/Formulario-Server-Firebase.git`). Cada vez que se hace un `git push` a la rama `main`, Render.com detecta los cambios y realiza un nuevo despliegue automáticamente.
* **Variables de Entorno en Render:** La variable `GOOGLE_APPLICATION_CREDENTIALS_JSON` se configura directamente en el panel de Render.com como una variable de entorno secreta para producción.

## 🤝 Contribuciones

Si deseas contribuir, por favor abre un 'issue' o 'pull request' en este repositorio.

---

Espero que esto te sea de gran utilidad para tu repositorio. ¡Avísame si quieres algún ajuste o adición!
