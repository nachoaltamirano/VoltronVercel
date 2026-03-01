/**
 * Voltron Lab - Panel de administración
 * Login, gestión de turnos (crear, eliminar, liberar)
 * Con actualización en tiempo real
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
    
    setupTabs();
});

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

    unsubscribeAdminData = subscribeToAdminDataRealtime(({ available, booked, appointments }) => {
        renderAvailableSlots(available);
        renderBookedSlots(booked);
        renderAppointments(appointments);
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
    await loadAvailableSlots();
    await loadBookedSlots();
    await loadAppointments();
}

/**
 * Carga y muestra turnos disponibles
 */
async function loadAvailableSlots() {
    const slots = await getAvailableSlots();
    renderAvailableSlots(slots);
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

        container.innerHTML = slots.map(slot => {
            const slotId = slot.id;
            const dateFormatted = formatDateForDisplay(slot.date);
            return `
                <div class="slot-item" data-slot-id="${slotId}">
                    <span class="slot-item-info">${dateFormatted} - ${slot.time}</span>
                    <div class="slot-item-actions">
                        <button class="btn btn-danger btn-delete-slot" data-slot-id="${slotId}" data-date="${slot.date}" data-time="${slot.time}">Eliminar</button>
                        <button class="btn btn-secondary btn-occupy-slot" data-slot-id="${slotId}" data-date="${slot.date}" data-time="${slot.time}">Marcar ocupado</button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.btn-delete-slot').forEach(btn => {
            btn.addEventListener('click', () => handleDeleteSlot(btn.dataset.slotId));
        });
        container.querySelectorAll('.btn-occupy-slot').forEach(btn => {
            btn.addEventListener('click', () => handleMarkOccupied(btn.dataset.date, btn.dataset.time));
        });
    } catch (error) {
        console.error('Error cargando turnos disponibles:', error);
        container.innerHTML = '<p class="empty-state">Error al cargar. Verificá Firebase.</p>';
    }
}

/**
 * Carga y muestra turnos ocupados
 */
async function loadBookedSlots() {
    const slots = await getBookedSlots();
    renderBookedSlots(slots);
}

/**
 * Renderiza la lista de turnos ocupados
 */
function renderBookedSlots(slots) {
    const container = document.getElementById('bookedSlotsList');
    if (!container) return;

    try {
        if (!slots || slots.length === 0) {
            container.innerHTML = '<p class="empty-state">No hay turnos ocupados.</p>';
            return;
        }

        container.innerHTML = slots.map(slot => {
            const slotId = slot.id;
            const dateFormatted = formatDateForDisplay(slot.date);
            return `
                <div class="slot-item" data-slot-id="${slotId}">
                    <span class="slot-item-info">${dateFormatted} - ${slot.time} ${slot.manual ? '(manual)' : ''}</span>
                    <div class="slot-item-actions">
                        <button class="btn btn-primary btn-release-slot" data-slot-id="${slotId}">Liberar turno</button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.btn-release-slot').forEach(btn => {
            btn.addEventListener('click', () => handleReleaseSlot(btn.dataset.slotId));
        });
    } catch (error) {
        console.error('Error cargando turnos ocupados:', error);
        container.innerHTML = '<p class="empty-state">Error al cargar.</p>';
    }
}

/**
 * Carga y muestra las reservas (appointments)
 */
async function loadAppointments() {
    const appointments = await getAppointments();
    renderAppointments(appointments);
}

/**
 * Renderiza la lista de reservas
 */
function renderAppointments(appointments) {
    const container = document.getElementById('appointmentsList');
    if (!container) return;

    try {
        if (!appointments || appointments.length === 0) {
            container.innerHTML = '<p class="empty-state">No hay reservas.</p>';
            return;
        }

        // Ordenar por fecha más reciente primero
        appointments.sort((a, b) => {
            const dateA = `${a.date} ${a.time}`;
            const dateB = `${b.date} ${b.time}`;
            return dateB.localeCompare(dateA);
        });

        container.innerHTML = appointments.map(apt => {
            const dateFormatted = formatDateForDisplay(apt.date);
            return `
                <div class="appointment-item">
                    <div class="appointment-item-info">
                        <span class="name">${apt.patientName}</span>
                        <div class="detail">${dateFormatted} - ${apt.time}</div>
                        <div class="detail">${apt.reason}</div>
                        <div class="detail">📞 ${apt.patientPhone}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error cargando reservas:', error);
        container.innerHTML = '<p class="empty-state">Error al cargar.</p>';
    }
}

/**
 * Formatea fecha para mostrar
 */
function formatDateForDisplay(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-AR', { 
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' 
    });
}

/**
 * Maneja la creación de un nuevo turno
 */
async function handleCreateSlot(e) {
    e.preventDefault();
    const dateInput = document.getElementById('newSlotDate');
    const timeInput = document.getElementById('newSlotTime');

    const dateStr = dateInput.value;
    const timeStr = timeInput.value;

    if (!dateStr || !timeStr) return;

    try {
        await createAvailableSlot(dateStr, timeStr);
        showAdminToast('Turno creado correctamente.');
        dateInput.value = '';
        timeInput.value = '';
        // loadAdminData se omite: el listener en tiempo real actualiza el panel
    } catch (error) {
        console.error('Error creando turno:', error);
        showAdminToast('Error al crear el turno.');
    }
}

/**
 * Maneja la eliminación de un turno disponible
 */
async function handleDeleteSlot(slotId) {
    if (!confirm('¿Eliminar este turno?')) return;

    try {
        await deleteAvailableSlot(slotId);
        showAdminToast('Turno eliminado.');
    } catch (error) {
        console.error('Error eliminando turno:', error);
        showAdminToast('Error al eliminar.');
    }
}

/**
 * Maneja marcar un turno como ocupado manualmente
 */
async function handleMarkOccupied(dateStr, timeStr) {
    if (!confirm('¿Marcar este turno como ocupado?')) return;

    try {
        await markSlotAsOccupiedManually(dateStr, timeStr);
        showAdminToast('Turno marcado como ocupado.');
    } catch (error) {
        console.error('Error:', error);
        showAdminToast('Error al actualizar.');
    }
}

/**
 * Maneja liberar un turno ocupado
 */
async function handleReleaseSlot(slotId) {
    if (!confirm('¿Liberar este turno? Volverá a estar disponible.')) return;

    try {
        await releaseSlot(slotId);
        showAdminToast('Turno liberado correctamente.');
    } catch (error) {
        console.error('Error liberando turno:', error);
        showAdminToast('Error al liberar.');
    }
}

/**
 * Configura las pestañas
 */
function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
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
