/**
 * Voltron Lab - Lógica de reserva de turnos
 * Formulario, validación y envío a Firebase + WhatsApp
 */

/**
 * Estado de autenticación y perfil del usuario
 */
let currentUserProfile = null;
let pendingBookingSlot = null;
let authMode = 'login';

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

    initAuthFlow();
    initProfilePanel();
}

/**
 * Inicializa el flujo de autenticación del usuario
 */
function initAuthFlow() {
    document.getElementById('authButton')?.addEventListener('click', () => openAuthModal('login'));
    document.getElementById('logoutHeaderBtn')?.addEventListener('click', handleHeaderLogout);
    document.getElementById('loginTab')?.addEventListener('click', () => setAuthMode('login'));
    document.getElementById('registerTab')?.addEventListener('click', () => setAuthMode('register'));
    document.getElementById('closeAuthModal')?.addEventListener('click', closeAuthModal);
    document.getElementById('cancelAuth')?.addEventListener('click', closeAuthModal);
    document.getElementById('authModal')?.querySelector('.modal-overlay')?.addEventListener('click', closeAuthModal);
    document.getElementById('authForm')?.addEventListener('submit', handleAuthSubmit);

    // Inicializar listener de autenticación
    onAuthStateChanged(handleAuthStateChanged);
}

/**
 * Abre el modal de reserva o pide login si no hay usuario
 */
function openBookingModal(slot) {
    const authUser = getCurrentUser();
    if (!authUser) {
        pendingBookingSlot = slot;
        openAuthModal('login');
        return;
    }

    const modal = document.getElementById('bookingModal');
    const slotText = document.getElementById('modalSlotText');
    
    if (modal && slotText) {
        slotText.textContent = formatDateTime(slot.date, slot.time);
        modal.dataset.slotDate = slot.date;
        modal.dataset.slotTime = slot.time;
        modal.classList.remove('hidden');
        prefillBookingForm();
    }
}

/**
 * Rellena el formulario con datos guardados del usuario
 */
function prefillBookingForm() {
    if (!currentUserProfile) return;
    const nombre = document.getElementById('nombre');
    const telefono = document.getElementById('telefono');
    const email = document.getElementById('email');

    if (nombre && currentUserProfile.nombre) {
        nombre.value = currentUserProfile.nombre;
    }
    if (telefono && currentUserProfile.telefono) {
        telefono.value = currentUserProfile.telefono;
    }
    if (email && currentUserProfile.email) {
        email.value = currentUserProfile.email;
    }
}

function initProfilePanel() {
    document.getElementById('profileLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        openProfilePanel();
    });
    document.getElementById('closeProfile')?.addEventListener('click', closeProfilePanel);
    document.getElementById('closeRatingModal')?.addEventListener('click', closeRatingModal);
    document.getElementById('cancelRating')?.addEventListener('click', closeRatingModal);
    document.getElementById('ratingForm')?.addEventListener('submit', handleRatingSubmit);
}

function openProfilePanel() {
    document.getElementById('profilePanel').classList.remove('hidden');
    document.getElementById('calendario').classList.add('hidden');
    loadSessionHistory();
}

function closeProfilePanel() {
    document.getElementById('profilePanel').classList.add('hidden');
    document.getElementById('calendario').classList.remove('hidden');
}

async function loadSessionHistory() {
    const authUser = getCurrentUser();
    if (!authUser) return;

    try {
        const appointments = await getAppointments();
        const userAppointments = appointments.filter(apt => apt.userId === authUser.uid && apt.status === 'confirmed');
        
        document.getElementById('sessionsCount').textContent = userAppointments.length;
        
        const ratings = userAppointments.filter(apt => apt.rating).map(apt => apt.rating);
        if (ratings.length > 0) {
            const avgRating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
            document.getElementById('avgRating').textContent = `${avgRating} ★`;
        }

        const sessionsList = document.getElementById('sessionsList');
        sessionsList.innerHTML = '';
        
        userAppointments.forEach((apt, index) => {
            const sessionNum = index + 1;
            const hasRating = apt.rating ? 'rated' : '';
            const ratingDisplay = apt.rating ? `${apt.rating} ★` : 'Sin calificar';
            
            let html = `
                <div class="session-card ${hasRating}">
                    <div class="session-header">
                        <span class="session-number">Sesión #${sessionNum}</span>
                        <span class="session-date">${formatDateTime(apt.date, apt.time)}</span>
                    </div>
                    <div class="session-details">
                        <p><strong>Motivo:</strong> ${apt.reason || 'N/A'}</p>`;
            
            if (apt.adminComments) {
                html += `<p><strong>📝 Detalles de la clase:</strong> ${apt.adminComments}</p>`;
            }
            
            html += `<p><strong>Calificación:</strong> ${ratingDisplay}</p>`;
            
            if (apt.feedback) {
                html += `<p><strong>Tu opinión:</strong> ${apt.feedback}</p>`;
            }
            
            if (!apt.rating) {
                html += `<button class="btn btn-primary btn-small" onclick="window.location.hash=''; openRatingModal(${JSON.stringify(apt).replace(/"/g, '&quot;')}, ${sessionNum})">Calificar sesión</button>`;
            }
            
            html += `</div></div>`;
            sessionsList.innerHTML += html;
        });
    } catch (error) {
        console.error('Error cargando historial:', error);
    }
}

let pendingRatingAppointment = null;
let pendingRatingSessionNum = null;

function openRatingModal(appointment, sessionNum) {
    pendingRatingAppointment = appointment;
    pendingRatingSessionNum = sessionNum;
    document.getElementById('ratingModal').classList.remove('hidden');
}

function closeRatingModal() {
    document.getElementById('ratingModal').classList.add('hidden');
    document.getElementById('ratingForm').reset();
    pendingRatingAppointment = null;
    pendingRatingSessionNum = null;
}

async function handleRatingSubmit(e) {
    e.preventDefault();
    if (!pendingRatingAppointment) return;

    const rating = document.querySelector('input[name="rating"]:checked')?.value;
    const feedback = document.getElementById('feedback')?.value || '';

    if (!rating) {
        showToast('Por favor seleccioná una calificación.');
        return;
    }

    try {
        await updateAppointmentRating(pendingRatingAppointment.id, parseInt(rating), feedback);
        showToast('¡Gracias por tu calificación!');
        closeRatingModal();
        loadSessionHistory();
    } catch (error) {
        console.error('Error guardando calificación:', error);
        showToast('Error al guardar la calificación.');
    }
}

function setAuthMode(mode) {
    authMode = mode;
    document.getElementById('loginTab')?.classList.toggle('active', mode === 'login');
    document.getElementById('registerTab')?.classList.toggle('active', mode === 'register');
    document.getElementById('authSubmit').textContent = mode === 'login' ? 'Ingresar' : 'Crear cuenta';
    document.getElementById('authError')?.classList.add('hidden');
}

function openAuthModal(mode = 'login') {
    setAuthMode(mode);
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    document.getElementById('authForm')?.reset();
    document.getElementById('authError')?.classList.add('hidden');
}

async function handleAuthStateChanged(user) {
    const statusEl = document.getElementById('userStatus');
    const authEmailEl = document.getElementById('authEmailDisplay');
    const authButton = document.getElementById('authButton');
    const profileLink = document.getElementById('profileLink');

    if (user) {
        closeAuthModal();
        showToast('Ingresaste exitosamente. Ya podés reservar.');
        authButton?.classList.add('hidden');
        statusEl?.classList.remove('hidden');
        profileLink?.classList.remove('hidden');
        if (authEmailEl) authEmailEl.textContent = `Bienvenido ${user.email}`;
        
        try {
            currentUserProfile = await getUserProfile(user.uid);
            if (!currentUserProfile) {
                const profileData = {
                    email: user.email || '',
                    nombre: user.displayName || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await saveUserProfile(user.uid, profileData);
                currentUserProfile = await getUserProfile(user.uid);
            }
            if (pendingBookingSlot) {
                openBookingModal(pendingBookingSlot);
                pendingBookingSlot = null;
            }
        } catch (error) {
            console.error('Error setting up user profile:', error);
            showToast('Tienes sesión iniciada pero hubo un error cargando tu perfil.');
        }
    } else {
        currentUserProfile = null;
        authButton?.classList.remove('hidden');
        statusEl?.classList.add('hidden');
        profileLink?.classList.add('hidden');
    }
}

async function handleHeaderLogout() {
    await signOutUser();
    showToast('Sesión cerrada. Para reservar, iniciá sesión de nuevo.');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value;
    const errorEl = document.getElementById('authError');

    if (!email || !password) {
        if (errorEl) {
            errorEl.textContent = 'Completá email y contraseña.';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    try {
        if (authMode === 'register') {
            await registerUser(email, password);
            showToast('Cuenta creada correctamente. Ya podés reservar.');
        } else {
            await loginUser(email, password);
            showToast('Ingresaste correctamente. Ya podés reservar.');
        }
        closeAuthModal();
    } catch (error) {
        console.error('Error auth detallado:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        let message = 'Error al procesar la solicitud.';
        if (error.code === 'auth/email-already-in-use') {
            message = 'El email ya está en uso.';
        } else if (error.code === 'auth/invalid-email') {
            message = 'El email no es válido.';
        } else if (error.code === 'auth/weak-password') {
            message = 'La contraseña debe tener al menos 6 caracteres.';
        } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            message = 'Email o contraseña incorrectos.';
        } else if (error.code === 'permission-denied') {
            message = 'Permiso denegado. Revisa las reglas de Firestore.';
        } else if (error.message) {
            message = error.message;
        }
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
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

    const authUser = getCurrentUser();
    const patientData = {
        nombre: form.nombre.value.trim(),
        telefono: form.telefono.value.trim(),
        email: form.email.value.trim(),
        motivo: form.motivo.value.trim()
    };

    if (authUser) {
        patientData.userId = authUser.uid;
        if (!patientData.email && authUser.email) {
            patientData.email = authUser.email;
        }
    }

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

        if (authUser) {
            await saveUserProfile(authUser.uid, {
                nombre: patientData.nombre,
                telefono: patientData.telefono,
                email: patientData.email || authUser.email
            });
            currentUserProfile = await getUserProfile(authUser.uid);
        }
        
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
