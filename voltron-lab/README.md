# Voltron Lab - Sistema de Reserva de Turnos

Sitio web moderno, responsive y profesional para Voltron Lab. Permite a los pacientes ver y reservar turnos, y al administrador gestionar la disponibilidad.

## Estructura del proyecto

```
voltron-lab/
├── index.html          # Página principal (calendario y reservas)
├── admin.html          # Panel de administración
├── css/
│   ├── styles.css      # Estilos principales
│   └── admin.css       # Estilos del panel admin
├── js/
│   ├── config.js       # Configuración Firebase (API keys)
│   ├── firebase-service.js  # Servicio Firestore y Auth
│   ├── calendar.js     # Lógica del calendario
│   ├── booking.js      # Lógica de reservas
│   ├── admin.js        # Panel de administración
│   └── main.js         # Punto de entrada
└── README.md
```

## Configuración de Firebase

### 1. Crear proyecto en Firebase

1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Crear un nuevo proyecto (ej: "voltron-lab")
3. Habilitar **Firestore Database** (modo producción)
4. Habilitar **Authentication** → método **Email/Password**

### 2. Configurar credenciales

Editar `js/config.js` y reemplazar con tus credenciales:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456"
};

const WHATSAPP_NUMBER = "5491112345678"; // Código país + número sin espacios
```

### 3. Reglas de Firestore

En Firebase Console → Firestore → Reglas, usar:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Lectura pública para turnos (pacientes pueden ver)
    match /availableSlots/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /bookedSlots/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /appointments/{doc} {
      allow read: if request.auth != null;
      allow create: if true;  // Pacientes pueden crear reservas
      allow update, delete: if request.auth != null;
    }
  }
}
```

### 4. Crear usuario administrador

En Firebase Console → Authentication → Users → Add user:
- Email: tu email
- Password: tu contraseña

## Estructura de datos en Firestore

### availableSlots
Document ID: `{fecha}_{hora}` (ej: `2025-03-15_0900`)
```
{
  date: "2025-03-15",
  time: "09:00",
  createdAt: Timestamp
}
```

### bookedSlots
Document ID: `{fecha}_{hora}`
```
{
  date: "2025-03-15",
  time: "09:00",
  appointmentId: "abc123",
  manual: false,  // true si fue marcado manualmente por admin
  bookedAt: Timestamp
}
```

### appointments
Document ID: auto-generado
```
{
  date: "2025-03-15",
  time: "09:00",
  patientName: "Juan Pérez",
  patientPhone: "+54 11 1234-5678",
  patientEmail: "juan@email.com",
  reason: "Consulta inicial",
  createdAt: Timestamp,
  status: "confirmed"
}
```

## Cómo ejecutar

1. Servir los archivos con un servidor local (Firebase requiere HTTPS o localhost):
   ```bash
   npx serve .
   ```
   O usar la extensión "Live Server" de VS Code.

2. Abrir `http://localhost:3000` (o el puerto que use tu servidor)

3. Panel admin: `http://localhost:3000/admin.html`

## Datos de ejemplo

**Opción 1 - Panel admin:** Una vez logueado, usar el formulario "Crear nuevo turno" para agregar disponibilidad.

**Opción 2 - Script de seed:** En `admin.html`, abrir la consola (F12), pegar y ejecutar:
```javascript
// Cargar seed-data.js primero si no está incluido, o pegar el contenido de seedSampleData()
```
O incluir `<script src="js/seed-data.js"></script>` en admin.html y ejecutar `seedSampleData()` desde la consola (logueado como admin).

**Opción 3 - Manual en Firestore:** Crear documentos en `availableSlots`:
- ID: `2025-03-15_0900` → date: "2025-03-15", time: "09:00"
- ID: `2025-03-15_1000` → date: "2025-03-15", time: "10:00"

## Funcionalidades

- **Calendario**: Mes actual y siguiente, turnos disponibles/ocupados
- **Reserva**: Formulario con nombre, teléfono, email (opcional), motivo
- **WhatsApp**: Mensaje automático al dueño con los datos de la reserva
- **Admin**: Crear/eliminar turnos, marcar ocupados, liberar turnos
