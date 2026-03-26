/**
 * Voltron Lab - Panel de administración (v2)
 * Login, gestión de turnos (crear, eliminar, liberar, reagendar)
 * Con calendario de 15 días y operaciones en tiempo real
 */

let unsubscribeAdminData = null;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged((user) => {
        if (user) {
            showAdminPanel(user);
        } else {
            showLoginScreen();
            if (unsubscribeAdminData) {
                unsubscribeAdminData();
                unsubscribeAdminData = null;
            }
        }
    });

    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('createSlotForm')?.addEventListener('submit', handleCreateSlot);
    
    // Manejo de toggle entre turno único y recurrente
    const slotTypeRadios = document.querySelectorAll('input[name="slotType"]');
    slotTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleSlotType);
    });
    
    setupMainTabs();
    setupRescheduleModal();
});


/**
 * Alterna entre turno único y recurrente
 */
function toggleSlotType(e) {
    const singleFields = document.getElementById('singleSlotFields');
    const recurringFields = document.getElementById('recurringSlotFields');
    
    if (e.target.value === 'single') {
        singleFields.classList.remove('hidden');
        recurringFields.classList.add('hidden');
    } else {
        singleFields.classList.add('hidden');
        recurringFields.classList.remove('hidden');
    }
}

/**
 * Muestra la pantalla de login
 */
function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
}

/**
 * Muestra el panel de administración
 */
function showAdminPanel(user) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('adminUserEmail').textContent = user.email;
    
    loadAdminData();
    setupAdminRealtimeUpdates();
}

/**
 * Configura actualización en tiempo real del panel admin
 */
function setupAdminRealtimeUpdates() {
    if (typeof subscribeToAdminDataRealtime !== 'function') return;

    unsubscribeAdminData = subscribeToAdminDataRealtime(({ available, booked, appointments, blockPatterns }) => {
        renderCalendar(booked, appointments);
        renderAvailableSlots(available);
    });
}

/**
 * Maneja el login
 */
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('loginError');

    errorEl.classList.add('hidden');

    try {
        await adminLogin(email, password);
    } catch (error) {
        let mensaje = 'Error al iniciar sesión.';
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            mensaje = 'Email o contraseña incorrectos.';
        } else if (error.code === 'auth/operation-not-allowed') {
            mensaje = 'El login con email/contraseña no está habilitado. Activálo en Firebase Console → Authentication → Sign-in method.';
        } else if (error.code === 'auth/invalid-email') {
            mensaje = 'El email no es válido.';
        } else if (error.code === 'auth/too-many-requests') {
            mensaje = 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.';
        } else if (error.code === 'auth/network-request-failed') {
            mensaje = 'Error de conexión. Verificá tu internet.';
        } else if (error.message) {
            mensaje = error.message;
        }
        errorEl.textContent = mensaje;
        errorEl.classList.remove('hidden');
    }
}

/**
 * Maneja el logout
 */
async function handleLogout() {
    await adminLogout();
}

/**
 * Carga los datos para el panel admin
 */
async function loadAdminData() {
    const booked = await getBookedSlots();
    const appointments = await getAppointments();
    const available = await getAvailableSlots();
    
    renderCalendar(booked, appointments);
    renderAvailableSlots(available);
}

/**
 * Renderiza el calendario de los próximos 15 días con turnos ocupados
 */
function renderCalendar(bookedSlots, appointments) {
    const container = document.getElementById('calendarView');
    if (!container) return;

    // Crear mapa de appointments por slot
    const appointmentMap = {};
    if (appointments) {
        appointments.forEach(apt => {
            const key = `${apt.date}_${apt.time.replace(':', '')}`;
            appointmentMap[key] = apt;
        });
    }

    // Obtener los próximos 15 días
    const today = new Date();
    const days = [];
    for (let i = 0; i < 15; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        days.push(date);
    }

    // Agrupar slots por día
    const slotsByDate = {};
    if (bookedSlots) {
        bookedSlots.forEach(slot => {
            if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
            slotsByDate[slot.date].push(slot);
        });
    }

    if (!bookedSlots || bookedSlots.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay turnos ocupados en los próximos 15 días.</p>';
        return;
    }

    let html = '<div class="calendar-grid">';
    
    days.forEach(date => {
        const dateStr = formatDateId(date);
        const daySlots = slotsByDate[dateStr] || [];

        if (daySlots.length > 0) {
            const dateFormatted = date.toLocaleDateString('es-AR', { 
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
            });

            html += `<div class="calendar-day">
                <h3 class="calendar-day-title">${dateFormatted}</h3>
                <div class="calendar-slots">`;

            daySlots.forEach(slot => {
                const apt = appointmentMap[`${slot.date}_${slot.time.replace(':', '')}`];
                if (apt && apt.patientName) {
                    html += `<div class="calendar-slot booked" data-apt-id="${apt.id}" data-date="${slot.date}" data-time="${slot.time}">
                        <div class="slot-time">${slot.time}</div>
                        <div class="slot-patient">${apt.patientName}</div>
                        <button class="btn btn-info btn-reschedule-slot" data-apt-id="${apt.id}" data-date="${slot.date}" data-time="${slot.time}">
                            Reagendar
                        </button>
                    </div>`;
                }
            });

            html += `</div></div>`;
        }
    });

    html += '</div>';
    container.innerHTML = html;

    // Agregar listeners a los botones de reagendar
    container.querySelectorAll('.btn-reschedule-slot').forEach(btn => {
        btn.addEventListener('click', () => {
            openRescheduleModal(
                btn.dataset.aptId,
                btn.dataset.date,
                btn.dataset.time
            );
        });
    });
}

/**
 * Renderiza la lista de turnos disponibles
 */
function renderAvailableSlots(slots) {
    const container = document.getElementById('availableSlotsList');
    if (!container) return;

    try {
        if (!slots || slots.length === 0) {
            container.innerHTML = '<p class="empty-state">No hay turnos disponibles. Creá uno arriba.</p>';
            return;
        }

        // Agrupar turnos por fecha
        const slotsByDate = {};
        slots.forEach(slot => {
            if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
            slotsByDate[slot.date].push(slot);
        });

        // Ordenar fechas
        const sortedDates = Object.keys(slotsByDate).sort();

        let html = '';
        sortedDates.forEach(dateStr => {
            const dateObj = new Date(dateStr + 'T00:00:00');
            const dateFormatted = dateObj.toLocaleDateString('es-AR', {
                weekday: 'long', day: 'numeric', month: 'long'
            });

            html += `<div class="available-date-group">
                <h3 class="date-group-title">${dateFormatted}</h3>`;

            slotsByDate[dateStr].forEach(slot => {
                html += `<div class="slot-item available">
                    <span class="slot-time">${slot.time}</span>
                    <div class="slot-actions">
                        <button class="btn btn-secondary btn-use-slot" data-date="${slot.date}" data-time="${slot.time}">
                            Usar horario
                        </button>
                        <button class="btn btn-danger btn-delete-slot" data-slot-id="${slot.id}">
                            Eliminar
                        </button>
                    </div>
                </div>`;
            });

            html += '</div>';
        });

        container.innerHTML = html;

        // Agregar listeners
        container.querySelectorAll('.btn-use-slot').forEach(btn => {
            btn.addEventListener('click', () => {
                preloadSlotInForm(btn.dataset.date, btn.dataset.time);
            });
        });

        container.querySelectorAll('.btn-delete-slot').forEach(btn => {
            btn.addEventListener('click', () => {
                handleDeleteSlot(btn.dataset.slotId);
            });
        });
    } catch (error) {
        console.error('Error renderizando turnos disponibles:', error);
        container.innerHTML = '<p class="empty-state">Error al cargar.</p>';
    }
}

/**
 * Precarga un slot en el formulario
 */
function preloadSlotInForm(date, time) {
    // Cambiar a tipo "single"
    const singleRadio = document.querySelector('input[name="slotType"][value="single"]');
    singleRadio.click();

    // Llenar los campos
    document.getElementById('newSlotDate').value = date;
    document.getElementById('newSlotTime').value = time;

    // Scroll al formulario
    document.querySelector('.admin-section').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Formatea fecha a YYYY-MM-DD
 */
function formatDateId(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Maneja la creación de un nuevo turno (único o recurrente)
 */
async function handleCreateSlot(e) {
    e.preventDefault();
    
    const slotType = document.querySelector('input[name="slotType"]:checked').value;

    try {
        if (slotType === 'single') {
            await handleCreateSingleSlot();
        } else {
            await handleCreateRecurringSlot();
        }
        
        // Limpiar formularios
        document.getElementById('createSlotForm').reset();
        showAdminToast('✅ Turno(s) creado(s) correctamente.');
    } catch (error) {
        console.error('Error creando turno:', error);
        showAdminToast('❌ Error al crear el turno.');
    }
}

/**
 * Crea un turno único
 */
async function handleCreateSingleSlot() {
    const dateStr = document.getElementById('newSlotDate').value;
    const timeStr = document.getElementById('newSlotTime').value;

    if (!dateStr || !timeStr) return;

    // Verificar si está bloqueado
    const isBlocked = await isTimeInBlockPattern(dateStr, timeStr);
    if (isBlocked) {
        throw new Error('Este turno está dentro de un bloqueo recurrente.');
    }

    await createAvailableSlot(dateStr, timeStr);
}

/**
 * Crea turnos recurrentes
 */
async function handleCreateRecurringSlot() {
    const selectedDays = Array.from(document.querySelectorAll('input[name="recurringDays"]:checked'))
        .map(el => parseInt(el.value));
    const timeStr = document.getElementById('recurringTime').value;
    const weeksCount = parseInt(document.getElementById('recurringDaysRange').value);

    if (selectedDays.length === 0 || !timeStr) return;

    // Generar dates para cada día seleccionado en las próximas N semanas
    const today = new Date();

    for (let week = 0; week < weeksCount; week++) {
        for (const dayOfWeek of selectedDays) {
            // dayOfWeek: 0=Lunes, 1=Martes, ..., 6=Domingo
            // En JS: 0=Domingo, 1=Lunes, ..., 6=Sábado
            // Convertir: dayOfWeek + 1 (excepto si es 6, que es domingo)
            const jsDay = dayOfWeek === 6 ? 0 : dayOfWeek + 1;

            const date = new Date(today);
            
            // Calcular días hasta el próximo día de la semana deseado
            const currentDay = date.getDay();
            let daysToAdd = jsDay - currentDay;
            if (daysToAdd < 0) daysToAdd += 7;
            if (week > 0) daysToAdd = 7;

            date.setDate(date.getDate() + (week * 7) + daysToAdd);

            const dateStr = formatDateId(date);

            // Verificar si está bloqueado
            const isBlocked = await isTimeInBlockPattern(dateStr, timeStr);
            if (!isBlocked) {
                await createAvailableSlot(dateStr, timeStr);
            }
        }
    }
}

/**
 * Maneja la eliminación de un turno disponible
 */
async function handleDeleteSlot(slotId) {
    if (!confirm('¿Eliminar este turno?')) return;

    try {
        await deleteAvailableSlot(slotId);
        showAdminToast('✅ Turno eliminado.');
    } catch (error) {
        console.error('Error eliminando turno:', error);
        showAdminToast('❌ Error al eliminar.');
    }
}

/**
 * Abre el modal de reagendar
 */
function openRescheduleModal(appointmentId, date, time) {
    document.getElementById('rescheduleAppointmentId').value = appointmentId;
    document.getElementById('rescheduleDate').value = date;
    document.getElementById('rescheduleTime').value = time;

    // Guardar valores antiguos para referencia
    document.getElementById('rescheduleDate').dataset.oldDate = date;
    document.getElementById('rescheduleTime').dataset.oldTime = time;

    // Limpiar validaciones
    document.getElementById('rescheduleDate').min = formatDateId(new Date());

    document.getElementById('rescheduleModal').classList.remove('hidden');
}

/**
 * Configura el modal de reagendar
 */
function setupRescheduleModal() {
    const modal = document.getElementById('rescheduleModal');
    if (!modal) return;

    document.getElementById('modalClose')?.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    document.getElementById('modalCancel')?.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    document.getElementById('rescheduleForm')?.addEventListener('submit', handleReschedule);

    // Cerrar al clickear fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}

/**
 * Maneja el reagendamiento de una cita
 */
async function handleReschedule(e) {
    e.preventDefault();

    const appointmentId = document.getElementById('rescheduleAppointmentId').value;
    const oldDate = document.getElementById('rescheduleDate').dataset.oldDate;
    const oldTime = document.getElementById('rescheduleTime').dataset.oldTime;
    const newDate = document.getElementById('rescheduleDate').value;
    const newTime = document.getElementById('rescheduleTime').value;

    if (!newDate || !newTime) return;

    try {
        // Obtener datos de la cita actual
        const appointments = await getAppointments();
        const apt = appointments.find(a => a.id === appointmentId);
        if (!apt) throw new Error('Cita no encontrada');

        // Revertir la cita actual
        await revertAppointment(appointmentId, apt.date, apt.time);

        // Marcar nuevo slot como ocupado
        await markSlotAsBooked(newDate, newTime, { id: appointmentId, ...apt });

        // Actualizar appointment con nueva fecha/hora
        await updateAppointmentDateTime(appointmentId, newDate, newTime);

        showAdminToast('✅ Turno reagendado correctamente.');
        document.getElementById('rescheduleModal').classList.add('hidden');
    } catch (error) {
        console.error('Error reagendando:', error);
        showAdminToast('❌ Error al reagendar.');
    }
}

/**
 * Actualiza la fecha y hora de un appointment
 */
async function updateAppointmentDateTime(appointmentId, newDate, newTime) {
    const appointmentsRef = db.collection('appointments');
    await appointmentsRef.doc(appointmentId).update({
        date: newDate,
        time: newTime,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Configura las pestañas principales
 */
function setupMainTabs() {
    const tabs = document.querySelectorAll('.tab-main');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}Tab`)?.classList.add('active');
        });
    });
}

/**
 * Muestra toast en el panel admin
 */
function showAdminToast(message) {
    const toast = document.getElementById('adminToast');
    const messageEl = document.getElementById('adminToastMessage');
    
    if (toast && messageEl) {
        messageEl.textContent = message;
        toast.classList.remove('hidden');
        toast.classList.add('visible');

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 3000);
    }
}
