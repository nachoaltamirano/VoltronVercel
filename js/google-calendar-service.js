/**
 * Voltron Lab - Exportación a Google Calendar (Manual)
 * Genera archivos .ics y enlaces para guardar en Google Calendar
 */

/**
 * Genera un archivo .ics (iCalendar) para una cita
 */
function generateICSFile(patientName, dateStr, timeStr, reason, phoneNumber) {
    const startDateTime = new Date(`${dateStr}T${timeStr}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60000); // 1 hora

    // Convertir a formato UTC para iCalendar
    const toICSDateTime = (date) => {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Voltron Lab//Calendar//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${patientName}-${dateStr}${timeStr.replace(':', '')}@voltronlab.local
DTSTAMP:${toICSDateTime(new Date())}
DTSTART:${toICSDateTime(startDateTime)}
DTEND:${toICSDateTime(endDateTime)}
SUMMARY:Cita - ${patientName}
DESCRIPTION:Paciente: ${patientName}\\nTelefono: ${phoneNumber}\\nMotivo: ${reason}
LOCATION:Voltron Lab
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    return icsContent;
}

/**
 * Descarga un archivo .ics para importar en Google Calendar
 */
function downloadICSFile(patientName, dateStr, timeStr, reason, phoneNumber) {
    const icsContent = generateICSFile(patientName, dateStr, timeStr, reason, phoneNumber);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${patientName}-${dateStr}-${timeStr.replace(':', '')}.ics`;
    link.click();
}

/**
 * Genera un enlace para crear un evento directamente en Google Calendar
 */
function generateGoogleCalendarLink(patientName, dateStr, timeStr, reason, phoneNumber) {
    const startDateTime = new Date(`${dateStr}T${timeStr}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60000); // 1 hora

    const toGoogleFormat = (date) => {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const title = `Cita - ${patientName}`;
    const description = `Paciente: ${patientName}\nTelefono: ${phoneNumber}\nMotivo: ${reason}`;

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        details: description,
        dates: `${toGoogleFormat(startDateTime)}/${toGoogleFormat(endDateTime)}`,
        location: 'Voltron Lab'
    });

    return `https://calendar.google.com/calendar/u/0/r/eventedit?${params.toString()}`;
}

/**
 * Abre Google Calendar en una nueva pestaña con los datos pre-llenados
 */
function openGoogleCalendarWithEvent(patientName, dateStr, timeStr, reason, phoneNumber) {
    const link = generateGoogleCalendarLink(patientName, dateStr, timeStr, reason, phoneNumber);
    window.open(link, '_blank');
}
