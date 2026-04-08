/**
 * Voltron Lab - Panel de administración (v2)
 * Login, gestión de turnos (crear, eliminar, liberar, reagendar)
 * Con calendario de 10 días y operaciones en tiempo real
 */

let unsubscribeAdminData = null;
let assignedPatientSingle = null;
let assignedPatientMultiple = null;
let assignedPatientSingleComment = null;
let assignedPatientMultipleComment = null;

document.addEventListener('DOMContentLoaded', () => {
    const ADMIN_EMAIL = 'voltronlab2@gmail.com';
    
    onAuthStateChanged((user) => {
        if (user && user.email === ADMIN_EMAIL) {
            showAdminPanel(user);
        } else {
            // Desautenticar si es un usuario no autorizado
            if (user) {
                adminLogout();
            }
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
    
    // Manejo de toggle entre turno único y múltiples
    const slotTypeRadios = document.querySelectorAll('input[name="slotType"]');
    slotTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleSlotType);
    });

    // Botón asignar paciente (turno único)
    document.querySelector('.btn-assign-patient-single')?.addEventListener('click', () => openAssignPatientModal('single'));
    
    // Checkbox para asignar paciente en múltiples turnos
    document.getElementById('multipleAssignPatient')?.addEventListener('change', (e) => {
        document.getElementById('multiplePatientFields').style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Botón asignar paciente (múltiples)
    document.querySelector('.btn-assign-patient-multiple')?.addEventListener('click', () => openAssignPatientModal('multiple'));
    
    setupMainTabs();
    setupRescheduleModal();
    setupAssignPatientModal();
});


/**
 * Alterna entre turno único y múltiples
 */
function toggleSlotType(e) {
    const singleFields = document.getElementById('singleSlotFields');
    const multipleFields = document.getElementById('multipleSlotFields');
    
    if (e.target.value === 'single') {
        singleFields.classList.remove('hidden');
        multipleFields.classList.add('hidden');
    } else if (e.target.value === 'multiple') {
        singleFields.classList.add('hidden');
        multipleFields.classList.remove('hidden');
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
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('loginError');
    const ADMIN_EMAIL = 'voltronlab2@gmail.com';

    errorEl.classList.add('hidden');

    // Validar que el email sea el admin permitido
    if (email !== ADMIN_EMAIL) {
        errorEl.textContent = 'Acceso denegado. Solo el administrador puede ingresar.';
        errorEl.classList.remove('hidden');
        return;
    }

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
 * Renderiza el calendario de los próximos 10 días con turnos ocupados
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

    // Obtener todos los días desde hoy hasta fin del mes siguiente
    const today = new Date();
    const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    
    const days = [];
    const currentDate = new Date(today);
    while (currentDate <= endOfNextMonth) {
        days.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
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
        container.innerHTML = '<p class="empty-state">No hay turnos ocupados en el mes actual y siguiente.</p>';
        return;
    }

    let html = '<div class="calendar-grid">';
    
    days.forEach(date => {
        const dateStr = formatDateId(date);
        const daySlots = slotsByDate[dateStr] || [];

        if (daySlots.length > 0) {
            const dateFormatted = formatDateDisplay(date);

            html += `<div class="calendar-day">
                <h3 class="calendar-day-title">${dateFormatted}</h3>
                <div class="calendar-slots">`;

            daySlots.forEach(slot => {
                const apt = appointmentMap[`${slot.date}_${slot.time.replace(':', '')}`];
                const patientName = apt?.patientName || slot.patientName;
                
                // Si es bloqueado, mostrar diferente
                if (slot.blocked) {
                    const blockedPatientName = slot.patientName ? ` - ${slot.patientName}` : '';
                    html += `<div class="calendar-slot blocked">
                        <div class="slot-time">${slot.time}</div>
                        <div class="slot-patient">🔒 Bloqueado${blockedPatientName}</div>
                        <div class="slot-actions-calendar">
                            <button class="btn btn-warning btn-unblock-slot" data-date="${slot.date}" data-time="${slot.time}">
                                🔓 Desbloquear
                            </button>
                        </div>
                    </div>`;
                } else if (patientName) {
                    // Mostrar si es appointment o turno manual con nombre
                    const aptId = apt?.id || `manual_${slot.date}_${slot.time.replace(':', '')}`;
                    html += `<div class="calendar-slot booked" data-apt-id="${aptId}" data-date="${slot.date}" data-time="${slot.time}" data-is-manual="${slot.manual || false}">
                        <div class="slot-time">${slot.time}</div>
                        <div class="slot-patient">${patientName}</div>
                        ${slot.manual ? '<span class="slot-badge">Manual</span>' : ''}
                        <div class="slot-actions-calendar">
                            <button class="btn btn-warning btn-block-from-calendar" data-apt-id="${aptId}" data-date="${slot.date}" data-time="${slot.time}" data-patient-name="${patientName}">
                                🔒 Bloquear
                            </button>
                            <button class="btn btn-info btn-reschedule-slot" data-apt-id="${aptId}" data-date="${slot.date}" data-time="${slot.time}" data-is-manual="${slot.manual || false}">
                                Reagendar
                            </button>
                            <button class="btn btn-danger btn-delete-from-calendar" data-apt-id="${aptId}" data-date="${slot.date}" data-time="${slot.time}" data-is-manual="${slot.manual || false}">
                                ✕ Eliminar
                            </button>
                        </div>
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
            const isManual = btn.dataset.isManual === 'true';
            openRescheduleModal(
                btn.dataset.aptId,
                btn.dataset.date,
                btn.dataset.time,
                isManual
            );
        });
    });

    // Agregar listeners a los botones de bloquear desde calendario
    container.querySelectorAll('.btn-block-from-calendar').forEach(btn => {
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const aptId = btn.dataset.aptId;
            const date = btn.dataset.date;
            const time = btn.dataset.time;
            const patientName = btn.dataset.patientName;
            
            await handleBlockSlotFromCalendar(aptId, date, time, patientName);
        });
    });

    // Agregar listeners a los botones de eliminar
    container.querySelectorAll('.btn-delete-from-calendar').forEach(btn => {
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const aptId = btn.dataset.aptId;
            const isManual = btn.dataset.isManual === 'true';
            const date = btn.dataset.date;
            const time = btn.dataset.time;
            
            await handleDeleteSlotFromCalendar(aptId, isManual, date, time);
        });
    });

    // Agregar listeners a los botones de desbloquear
    container.querySelectorAll('.btn-unblock-slot').forEach(btn => {
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const date = btn.dataset.date;
            const time = btn.dataset.time;
            
            await handleUnblockSlot(date, time);
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

        // Filtrar slots: solo de hoy y próximos 10 días
        const today = new Date();
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + 10);

        const todayStr = formatDateId(today);
        const maxDateStr = formatDateId(maxDate);

        const filteredSlots = slots.filter(slot => 
            slot.date >= todayStr && slot.date <= maxDateStr
        );

        if (filteredSlots.length === 0) {
            container.innerHTML = '<p class="empty-state">No hay turnos disponibles en los próximos 10 días.</p>';
            return;
        }

        // Agrupar turnos por fecha
        const slotsByDate = {};
        filteredSlots.forEach(slot => {
            if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
            slotsByDate[slot.date].push(slot);
        });

        // Ordenar fechas
        const sortedDates = Object.keys(slotsByDate).sort();

        let html = '';
        sortedDates.forEach(dateStr => {
            const dateObj = new Date(dateStr + 'T00:00:00');
            const dateFormatted = formatDateDisplay(dateObj);

            html += `<div class="available-date-group">
                <h3 class="date-group-title">${dateFormatted}</h3>`;

            slotsByDate[dateStr].forEach(slot => {
                html += `<div class="slot-item available">
                    <span class="slot-time">${slot.time}</span>
                    <div class="slot-actions">
                        <button class="btn btn-secondary btn-use-slot" data-date="${slot.date}" data-time="${slot.time}">
                            Usar horario
                        </button>
                        <button class="btn btn-warning btn-block-slot" data-date="${slot.date}" data-time="${slot.time}" data-slot-id="${slot.id}">
                            🔒 Bloquear
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

        container.querySelectorAll('.btn-block-slot').forEach(btn => {
            btn.addEventListener('click', () => {
                handleBlockSlot(btn.dataset.date, btn.dataset.time, btn.dataset.slotId);
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
 * Formatea fecha para mostrar al usuario (dd/mm/yyyy con día de la semana en español)
 */
function formatDateDisplay(date) {
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    const dayOfWeek = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayOfWeek}, ${day} de ${month} de ${year}`;
}

/**
 * Maneja la creación de un nuevo turno (único o múltiples)
 */
async function handleCreateSlot(e) {
    e.preventDefault();
    
    console.log('🔵 handleCreateSlot called');
    
    const slotType = document.querySelector('input[name="slotType"]:checked').value;
    console.log('Slot type:', slotType);

    try {
        if (slotType === 'single') {
            console.log('📍 Creating single slot');
            await handleCreateSingleSlot();
        } else if (slotType === 'multiple') {
            console.log('📍 Creating multiple slots');
            await handleCreateMultipleSlots();
        }
        
        // Limpiar formularios
        document.getElementById('createSlotForm').reset();
        document.getElementById('multipleAssignPatient').checked = false;
        document.getElementById('multiplePatientFields').style.display = 'none';
        showAdminToast('✅ Turno(s) creado(s) correctamente.');
        console.log('✅ Turnos creados exitosamente');
    } catch (error) {
        console.error('❌ Error creando turno:', error);
        console.error('Error message:', error.message);
        console.error('Stack:', error.stack);
        const errorMsg = error.message || 'Error desconocido al crear el turno.';
        showAdminToast(`❌ ${errorMsg}`);
    }
}

/**
 * Crea un turno único
 */
async function handleCreateSingleSlot() {
    const dateStr = document.getElementById('singleDate').value;
    const timeStr = document.getElementById('singleTime').value;

    console.log('Single slot - Date:', dateStr, 'Time:', timeStr);

    if (!dateStr || !timeStr) {
        throw new Error('Completa la fecha y hora del turno.');
    }

    // Verificar si está bloqueado
    const isBlocked = await isTimeInBlockPattern(dateStr, timeStr);
    if (isBlocked) {
        throw new Error('Este turno está dentro de un bloqueo recurrente.');
    }

    // Si tiene paciente asignado, crear como ocupado (booked manually)
    if (assignedPatientSingle) {
        console.log('Creating booked slot with patient:', assignedPatientSingle);
        await markSlotAsOccupiedManuallyWithName(dateStr, timeStr, assignedPatientSingle, assignedPatientSingleComment);
        assignedPatientSingle = null;
        assignedPatientSingleComment = null;
        document.getElementById('patientInfoSingle').style.display = 'none';
    } else {
        // Si no, crear como disponible
        console.log('Creating available slot');
        await createAvailableSlot(dateStr, timeStr);
    }
}

/**
 * Crea múltiples turnos (varios días y horas)
 */
async function handleCreateMultipleSlots() {
    const selectedDays = Array.from(document.querySelectorAll('input[name="multipleDays"]:checked'))
        .map(el => parseInt(el.value));
    const weeksCount = parseInt(document.getElementById('multipleWeeks').value);
    const startTimeStr = document.getElementById('multipleStartTime').value;
    const endTimeStr = document.getElementById('multipleEndTime').value;
    const hasPatient = document.getElementById('multipleAssignPatient').checked;
    const patientTimeStr = hasPatient ? document.getElementById('multiplePatientTime').value : null;

    console.log('🔵 Multiple slots - Days:', selectedDays, 'Weeks:', weeksCount, 'Start:', startTimeStr, 'End:', endTimeStr, 'HasPatient:', hasPatient, 'PatientTime:', patientTimeStr);

    // Validaciones
    if (selectedDays.length === 0) {
        console.error('❌ No days selected');
        throw new Error('Selecciona al menos un día de la semana (Lunes, Miércoles, Viernes, etc.)');
    }
    if (!startTimeStr) {
        console.error('❌ Start time empty:', startTimeStr);
        throw new Error('Completa la hora inicio (ej: 14:00 para 2pm)');
    }
    if (!endTimeStr) {
        console.error('❌ End time empty:', endTimeStr);
        throw new Error('Completa la hora fin (ej: 19:00 para 7pm)');
    }
    if (hasPatient && !patientTimeStr) {
        throw new Error('Completa la hora del paciente.');
    }

    // Convertir strings de time a minutos para comparación
    const [startHour, startMin] = startTimeStr.split(':').map(Number);
    const [endHour, endMin] = endTimeStr.split(':').map(Number);
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;

    console.log(`⏰ Time calculation: ${startTimeStr} = ${startTotalMin} min, ${endTimeStr} = ${endTotalMin} min`);

    if (startTotalMin >= endTotalMin) {
        console.error(`❌ Invalid time range: ${startTotalMin} >= ${endTotalMin}`);
        throw new Error(`La hora inicio debe ser menor a la hora fin. (Inicio: ${startTimeStr} = ${startTotalMin}min, Fin: ${endTimeStr} = ${endTotalMin}min)`);
    }

    const today = new Date();
    console.log(`📅 Creating slots starting from: ${formatDateId(today)}`);

    // Para cada semana
    let totalSlotsCreated = 0;
    for (let week = 0; week < weeksCount; week++) {
        // Para cada día seleccionado
        for (const dayOfWeek of selectedDays) {
            // dayOfWeek: 0=Lunes, 1=Martes, ..., 6=Domingo
            // En JS: 0=Domingo, 1=Lunes, ..., 6=Sábado
            // Convertir: dayOfWeek + 1 (excepto si es 6, que es domingo)
            const jsDay = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
            const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            
            const date = new Date(today);
            
            // Calcular días hasta el próximo día de la semana deseado
            const currentDay = date.getDay();
            let daysToAdd = jsDay - currentDay;
            if (daysToAdd < 0) daysToAdd += 7;
            if (daysToAdd === 0 && week === 0) daysToAdd = 0; // Si es hoy y primera semana
            
            // Sumar los días hasta el próximo día de la semana + las semanas adicionales
            date.setDate(date.getDate() + daysToAdd + (week * 7));
            const dateStr = formatDateId(date);
            const dayName = dayNames[date.getDay()];

            console.log(`📆 Week ${week}, Creating slots for ${dayName} ${dateStr}`);

            // Generar slots de 1 hora en el rango
            let currentTotalMin = startTotalMin;
            while (currentTotalMin < endTotalMin) {
                const hour = Math.floor(currentTotalMin / 60);
                const min = currentTotalMin % 60;
                const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

                // Verificar si está bloqueado
                const isBlocked = await isTimeInBlockPattern(dateStr, timeStr);
                if (!isBlocked) {
                    // Si hay paciente y es la hora del paciente, crear como ocupado
                    if (hasPatient && patientTimeStr && timeStr === patientTimeStr && assignedPatientMultiple) {
                        console.log(`  ✅ BOOKED: ${timeStr} for ${assignedPatientMultiple}`);
                        await markSlotAsOccupiedManuallyWithName(dateStr, timeStr, assignedPatientMultiple, assignedPatientMultipleComment);
                        totalSlotsCreated++;
                    } else {
                        // Si no, crear como disponible
                        console.log(`  ✅ AVAILABLE: ${timeStr}`);
                        await createAvailableSlot(dateStr, timeStr);
                        totalSlotsCreated++;
                    }
                } else {
                    console.log(`  ⏭️ BLOCKED: ${timeStr}`);
                }

                currentTotalMin += 60; // Sumar 1 hora
            }
        }
    }

    console.log(`🎉 Total slots created: ${totalSlotsCreated}`);

    // Limpiar paciente después de crear
    assignedPatientMultiple = null;
    assignedPatientMultipleComment = null;
    document.getElementById('patientInfoMultiple').style.display = 'none';
}

/**
 * Maneja el bloqueo de un turno disponible
 */
async function handleBlockSlot(dateStr, timeStr, slotId) {
    if (!confirm(`¿Bloquear el turno ${timeStr}? Se bloqueará para las próximas 8 semanas en todos los calendarios.`)) return;

    try {
        console.log(`🔒 Bloqueando slot: ${dateStr} ${timeStr} (8 semanas)`);
        
        // Eliminar de disponibles (turno original)
        await deleteAvailableSlot(slotId);
        
        // Crear bloqueos para 8 semanas
        const blockedDates = await blockSlotForWeeks(dateStr, timeStr, slotId);
        
        console.log(`✅ Slot bloqueado para ${blockedDates.length} semanas`);
        showAdminToast(`🔒 Horario ${timeStr} bloqueado por 8 semanas.`);
    } catch (error) {
        console.error('❌ Error bloqueando turno:', error);
        showAdminToast(`❌ Error: ${error.message}`);
    }
}

/**
 * Bloquea un turno que ya tiene paciente asignado
 */
async function handleBlockSlotFromCalendar(aptId, dateStr, timeStr, patientName) {
    if (!confirm(`¿Bloquear el horario ${timeStr}? Se bloqueará para las próximas 8 semanas. El paciente ${patientName} se mantiene.`)) return;

    try {
        console.log(`🔒 Bloqueando horario con paciente: ${dateStr} ${timeStr} - ${patientName} (8 semanas)`);
        
        // Crear bloqueos para 8 semanas (solo para futuras instancias)
        // Pasar el nombre del paciente para que aparezca en los bloqueos
        const blockedDates = await blockSlotForWeeks(dateStr, timeStr, null, patientName);
        
        console.log(`✅ Horario bloqueado para ${blockedDates.length - 1} semanas futuras. Paciente ${patientName} se conserva en turno actual.`);
        showAdminToast(`🔒 Horario ${timeStr} bloqueado por 8 semanas. Paciente ${patientName} se conserva.`);
    } catch (error) {
        console.error('❌ Error bloqueando turno:', error);
        showAdminToast(`❌ Error: ${error.message}`);
    }
}

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
 * Desbloquea un turno bloqueado del calendario (8 semanas)
 */
async function handleUnblockSlot(dateStr, timeStr) {
    if (!confirm(`¿Desbloquear el turno ${timeStr}? Se desbloqueará para las próximas 8 semanas.`)) return;

    try {
        console.log(`🔓 Desbloqueando slots: ${dateStr} ${timeStr} (8 semanas)`);
        
        // Parsear la fecha base
        const [year, month, day] = dateStr.split('-').map(Number);
        const baseDate = new Date(year, month - 1, day);
        
        let unlockedCount = 0;
        
        // Desbloquear para 8 semanas (0 a 7)
        for (let week = 0; week < 8; week++) {
            const futureDate = new Date(baseDate);
            futureDate.setDate(futureDate.getDate() + (week * 7));
            const futureDateStr = formatDateId(futureDate);
            const slotId = `${futureDateStr}_${timeStr.replace(':', '')}`;
            
            try {
                const doc = await db.collection('bookedSlots').doc(slotId).get();
                if (doc.exists && doc.data().blocked) {
                    await db.collection('bookedSlots').doc(slotId).delete();
                    unlockedCount++;
                    console.log(`  ✓ Desbloqueado: ${futureDateStr} ${timeStr}`);
                }
            } catch (error) {
                console.error(`  ❌ Error desbloqueando ${futureDateStr}: ${error.message}`);
            }
        }
        
        console.log(`✅ Slots desbloqueados exitosamente (${unlockedCount} semanas)`);
        showAdminToast(`🔓 Horario ${timeStr} desbloqueado por 8 semanas.`);
    } catch (error) {
        console.error('❌ Error desbloqueando turno:', error);
        showAdminToast(`❌ Error: ${error.message}`);
    }
}

/**
 * Abre el modal de reagendar
 */
function openRescheduleModal(appointmentId, date, time, isManual = false) {
    document.getElementById('rescheduleAppointmentId').value = appointmentId;
    document.getElementById('rescheduleDate').value = date;
    document.getElementById('rescheduleTime').value = time;
    document.getElementById('rescheduleForm').dataset.isManual = isManual;

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
    const isManual = document.getElementById('rescheduleForm').dataset.isManual === 'true';
    const oldDate = document.getElementById('rescheduleDate').dataset.oldDate;
    const oldTime = document.getElementById('rescheduleTime').dataset.oldTime;
    const newDate = document.getElementById('rescheduleDate').value;
    const newTime = document.getElementById('rescheduleTime').value;

    if (!newDate || !newTime) return;

    try {
        if (isManual) {
            // Para turnos manuales: eliminar del antiguo lugar y crear en el nuevo
            const slotId = `${oldDate}_${oldTime.replace(':', '')}`;
            const bookedDoc = await getBookedSlotDoc(slotId);
            
            if (bookedDoc.exists) {
                const data = bookedDoc.data();
                const patientName = data.patientName;
                
                // Eliminar turno anterior
                await deleteBookedSlot(slotId);
                
                // Crear turno en nueva fecha/hora
                await markSlotAsOccupiedManuallyWithName(newDate, newTime, patientName);
            }
        } else {
            // Para appointments: reagendar normalmente
            const appointments = await getAppointments();
            const apt = appointments.find(a => a.id === appointmentId);
            if (!apt) throw new Error('Cita no encontrada');

            // Revertir la cita actual
            await revertAppointment(appointmentId, apt.date, apt.time);

            // Marcar nuevo slot como ocupado
            await markSlotAsBooked(newDate, newTime, { id: appointmentId, ...apt });

            // Actualizar appointment con nueva fecha/hora
            await updateAppointmentDateTime(appointmentId, newDate, newTime);
        }

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
 * Abre el modal de asignar paciente
 */
/**
 * Abre el modal de asignar paciente
 */
function openAssignPatientModal(type) {
    document.getElementById('assignPatientForm').dataset.type = type;
    document.getElementById('assignPatientName').value = '';
    document.getElementById('assignPatientLastName').value = '';
    document.getElementById('assignPatientComment').value = '';
    document.getElementById('assignPatientModal').classList.remove('hidden');
}

/**
 * Configura el modal de asignar paciente
 */
function setupAssignPatientModal() {
    const modal = document.getElementById('assignPatientModal');
    if (!modal) return;

    document.getElementById('assignPatientModalClose')?.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    document.getElementById('assignPatientModalCancel')?.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    document.getElementById('assignPatientForm')?.addEventListener('submit', handleAssignPatient);

    // Cerrar al clickear fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}

/**
 * Maneja la asignación de paciente
 */
/**
 * Maneja la asignación de paciente
 */
/**
 * Maneja la asignación de paciente
 */
function handleAssignPatient(e) {
    e.preventDefault();

    const type = document.getElementById('assignPatientForm').dataset.type;
    const name = document.getElementById('assignPatientName').value.trim();
    const lastName = document.getElementById('assignPatientLastName').value.trim();
    const comment = document.getElementById('assignPatientComment').value.trim();

    if (!name || !lastName) {
        showAdminToast('❌ Nombre y apellido son requeridos.');
        return;
    }

    const fullName = `${name} ${lastName}`;

    if (type === 'single') {
        assignedPatientSingle = fullName;
        assignedPatientSingleComment = comment;
        document.getElementById('assignedPatientSingle').textContent = fullName;
        document.getElementById('patientInfoSingle').style.display = 'block';
    } else if (type === 'multiple') {
        assignedPatientMultiple = fullName;
        assignedPatientMultipleComment = comment;
        document.getElementById('assignedPatientMultiple').textContent = fullName;
        document.getElementById('patientInfoMultiple').style.display = 'block';
    }

    showAdminToast(`✅ Paciente asignado: ${fullName}`);
    document.getElementById('assignPatientModal').classList.add('hidden');
}

/**
 * Limpia el paciente asignado (turno único)
 */
/**
 * Limpia el paciente asignado (turno único)
 */
function clearPatientSingle() {
    assignedPatientSingle = null;
    assignedPatientSingleComment = null;
    document.getElementById('patientInfoSingle').style.display = 'none';
    showAdminToast('🗑️ Paciente removido.');
}

/**
 * Limpia el paciente asignado (múltiples turnos)
 */
function clearPatientMultiple() {
    assignedPatientMultiple = null;
    assignedPatientMultipleComment = null;
    document.getElementById('patientInfoMultiple').style.display = 'none';
    showAdminToast('🗑️ Paciente removido.');
}

/**
 * Maneja la eliminación de un turno del calendario
 */
async function handleDeleteSlotFromCalendar(aptId, isManual, date, time) {
    if (!confirm('¿Eliminar este turno? Se perderá la cita del paciente.')) return;

    try {
        if (isManual) {
            // Para turnos manuales: eliminar del bookedSlots
            const slotId = `${date}_${time.replace(':', '')}`;
            await deleteBookedSlot(slotId);
        } else {
            // Para appointments: revertir la cita
            await revertAppointment(aptId, date, time);
        }

        showAdminToast('✅ Turno eliminado correctamente.');
    } catch (error) {
        console.error('Error eliminando turno del calendario:', error);
        showAdminToast('❌ Error al eliminar.');
    }
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
