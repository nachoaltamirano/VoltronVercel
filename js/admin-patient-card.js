/**
 * Funciones para mostrar tarjeta/ficha del paciente en admin panel
 */

let selectedPatientData = null;

function showPatientCard(userId, patientName) {
    selectedPatientData = { userId, patientName };
    openPatientCardModal();
}

function openPatientCardModal() {
    const modal = document.getElementById('patientCardModal');
    if (modal) {
        modal.classList.remove('hidden');
        loadPatientDetails();
    }
}

function closePatientCardModal() {
    const modal = document.getElementById('patientCardModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    selectedPatientData = null;
}

async function loadPatientDetails() {
    if (!selectedPatientData) return;
    
    try {
        const appointments = await getAppointments();
        const userAppointments = appointments.filter(apt => 
            apt.userId === selectedPatientData.userId && apt.status === 'confirmed'
        );

        // Calcular estadísticas
        const totalSessions = userAppointments.length;
        const ratings = userAppointments.filter(apt => apt.rating).map(apt => apt.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 0;
        const totalFeedback = userAppointments.filter(apt => apt.feedback).length;

        // Armar el HTML de la tarjeta
        let html = `
            <div class="patient-card-header">
                <h3>${selectedPatientData.patientName}</h3>
                <p class="patient-email" id="patientEmailCard">Cargando...</p>
            </div>

            <div class="patient-stats-grid">
                <div class="patient-stat">
                    <span class="stat-value">${totalSessions}</span>
                    <span class="stat-label">Sesiones</span>
                </div>
                <div class="patient-stat">
                    <span class="stat-value">${avgRating > 0 ? avgRating + ' ★' : 'N/A'}</span>
                    <span class="stat-label">Calificación promedio</span>
                </div>
                <div class="patient-stat">
                    <span class="stat-value">${totalFeedback}</span>
                    <span class="stat-label">Opiniones</span>
                </div>
            </div>

            <div class="patient-sessions-history">
                <h4>Historial de sesiones</h4>
                <div class="sessions-table">
        `;

        userAppointments.forEach((apt, index) => {
            const sessionNum = index + 1;
            const ratingDisplay = apt.rating ? `${apt.rating} ★` : 'Sin calificar';
            const feedbackDisplay = apt.feedback ? `<div class="feedback-text">"${apt.feedback}"</div>` : '';
            
            html += `
                <div class="session-row">
                    <div class="session-col-num">#${sessionNum}</div>
                    <div class="session-col-date">${formatDateTime(apt.date, apt.time)}</div>
                    <div class="session-col-reason">${apt.reason}</div>
                    <div class="session-col-rating">${ratingDisplay}</div>
                    ${feedbackDisplay ? `<div class="session-col-feedback">${feedbackDisplay}</div>` : ''}
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        document.getElementById('patientCardContent').innerHTML = html;
        
        // Cargar email del paciente desde usuarioProfile
        const userProfile = await getUserProfile(selectedPatientData.userId);
        if (userProfile && userProfile.email) {
            const emailEl = document.getElementById('patientEmailCard');
            if (emailEl) emailEl.textContent = userProfile.email;
        }
    } catch (error) {
        console.error('Error cargando detalles del paciente:', error);
    }
}

/**
 * Calcula el número de sesión del paciente para una fecha específica
 */
function getSessionNumber(appointments, userId, upToDate) {
    const userApts = appointments
        .filter(apt => apt.userId === userId && apt.status === 'confirmed')
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let count = 0;
    for (let apt of userApts) {
        if (apt.date <= upToDate) {
            count++;
        } else {
            break;
        }
    }
    return count;
}
