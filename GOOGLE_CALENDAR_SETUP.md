# Integración Google Calendar - Guía Simple

## ¿Qué es esto?

La integración de Google Calendar te permite que los pacientes **guarden sus citas automáticamente en Google Calendar** con un solo click. No requiere ninguna configuración de Google Cloud Console.

## ¿Cómo funciona?

### Para los pacientes (al hacer una reserva):
1. Hacen su reserva normalmente
2. Después de confirmar, aparece un mensaje: **"¿Queres guardar el turno en google calendar?"**
3. Si dicen "Sí", se abre Google Calendar con la cita pre-llenada
4. Solo tienen que hacer clic en "Guardar"

### Para ti (en el panel admin):
1. En la pestaña "Reservas", ves un botón **"📅 Exportar"** al lado de cada cita
2. Al hacer clic, se abre Google Calendar con la cita pre-llenada
3. Completas los detalles y guardas

## ¿Qué información se envía a Google Calendar?

📌 Nombre del paciente
📅 Fecha y hora de la cita
📝 Motivo del turno
📞 Teléfono del paciente

## ¿Necesito configurar algo?

**¡No!** Esta integración es completamente manual y no requiere ninguna configuración de Google Cloud Console.

Los pacientes simplemente:
1. Hacen una reserva
2. Responden "Sí" cuando se les pregunta si quieren guardar en Google Calendar
3. Se abre Google Calendar en una nueva pestaña
4. Hacen clic en "Guardar" listo

Lo mismo aplica para ti desde el panel admin con el botón "📅 Exportar".

## Troubleshooting

### ❌ "El botón no abre Google Calendar"
- Asegúrate de tener una cuenta de Google iniciada en tu navegador
- Si usar múltiples cuentas, puede abrirse la pestaña equivocada

### ❌ "Los datos no aparecen pre-llenados"
- Recarga la página
- Limpia el cache del navegador

### ❌ "¿Cómo descargo un archivo .ics?"
- Puedes generar un archivo `.ics` editando el código en `google-calendar-service.js`
- Pero la forma más simple es usar el método "Abrir en Google Calendar" que ya está implementado

## Más detalles técnicos

El sistema usa dos métodos:
1. **URL de Google Calendar**: Abre Google Calendar con datos pre-llenados
2. **Archivo .ics**: Genera un archivo que puedes descargar e importar manualmente

Ambos están disponibles en el código, pero utilizamos el primero (URL) por ser más simple para los usuarios.

