/**
 * Voltron Lab - Lógica de reserva de turnos
 * Formulario, validación y envío a Firebase + WhatsApp
 */

/**
 * Inicializa el flujo de reserva
 */
function initBooking() {
    const confirmBtn = document.getElementById('confirmSelection');
    const modal = document.getElementById('bookingModal');
    const closeBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBooking');
    const form = document.getElementById('bookingForm');

    confirmBtn?.addEventListener('click', () => {
        const slot = getSelectedSlot();
        if (slot) {
            openBookingModal(slot);
        }
    });

    closeBtn?.addEventListener('click', closeBookingModal);
    cancelBtn?.addEventListener('click', closeBookingModal);
    modal?.querySelector('.modal-overlay')?.addEventListener('click', closeBookingModal);

    form?.addEventListener('submit', handleBookingSubmit);
}

/**
 * Abre el modal de reserva
 */
function openBookingModal(slot) {
    const modal = document.getElementById('bookingModal');
    const slotText = document.getElementById('modalSlotText');
    
    if (modal && slotText) {
        slotText.textContent = formatDateTime(slot.date, slot.time);
        modal.dataset.slotDate = slot.date;
        modal.dataset.slotTime = slot.time;
        modal.classList.remove('hidden');
    }
}

/**
 * Cierra el modal de reserva
 */
function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('bookingForm')?.reset();
    }
}

/**
 * Maneja el envío del formulario de reserva
 */
async function handleBookingSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const slotDate = form.closest('.modal')?.dataset.slotDate;
    const slotTime = form.closest('.modal')?.dataset.slotTime;
    const saveToCalendar = form.saveToCalendar?.checked || false;

    if (!slotDate || !slotTime) {
        showToast('Error: turno no válido.');
        return;
    }

    const patientData = {
        nombre: form.nombre.value.trim(),
        telefono: form.telefono.value.trim(),
        email: form.email.value.trim(),
        motivo: form.motivo.value.trim()
    };

    // Validaciones básicas
    if (!patientData.nombre || patientData.nombre.length < 2) {
        showToast('Por favor ingresá tu nombre completo.');
        return;
    }
    if (!patientData.telefono || patientData.telefono.length < 8) {
        showToast('Por favor ingresá un teléfono válido.');
        return;
    }
    if (!patientData.motivo || patientData.motivo.length < 5) {
        showToast('Por favor describí brevemente el motivo de tu sesión.');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Reservando...';

    try {
        console.log('📝 Iniciando creación de appointment:', { slotDate, slotTime, patientData });
        const appointmentId = await createAppointment(slotDate, slotTime, patientData);
        console.log('✅ Appointment creado exitosamente:', appointmentId);
        
        // Generar mensaje de WhatsApp
        const whatsappMessage = generateWhatsAppMessage(patientData, slotDate, slotTime);
        const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

        closeBookingModal();
        clearSelection();
        await loadSlotsData();
        renderCalendar();

        showToast('¡Reserva confirmada! Te enviamos los detalles por WhatsApp.');

        // Si el usuario marcó la opción, abrir Google Calendar
        if (saveToCalendar) {
            openGoogleCalendarWithEvent(
                patientData.nombre,
                slotDate,
                slotTime,
                patientData.motivo,
                patientData.telefono
            );
            showToast('Se abrió Google Calendar. Guardá la cita en tu calendario.');
        }

        // Abrir WhatsApp en nueva pestaña
        window.open(whatsappUrl, '_blank');
    } catch (error) {
        console.error('❌ Error al reservar:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            name: error.name,
            stack: error.stack
        });
        
        // Mostrar mensaje de error más específico
        let errorMessage = 'Error al crear el turno.';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permiso denegado. Contactá al administrador.';
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        showToast(errorMessage);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirmar reserva';
    }
}

/**
 * Genera el mensaje predeterminado para WhatsApp
 */
function generateWhatsAppMessage(patientData, dateStr, timeStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dateFormatted = date.toLocaleDateString('es-AR', { 
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
    });

    return `*Nueva reserva - Voltron Lab*

👤 *Paciente:* ${patientData.nombre}
📅 *Fecha y hora:* ${dateFormatted} a las ${timeStr}
📋 *Motivo:* ${patientData.motivo}
📞 *Teléfono:* ${patientData.telefono}
${patientData.email ? `📧 *Email:* ${patientData.email}` : ''}`;
}
