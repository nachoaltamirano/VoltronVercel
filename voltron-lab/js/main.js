/**
 * Voltron Lab - Punto de entrada principal
 * Inicializa el calendario, reservas y oculta el loader
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar calendario y cargar datos
    await initCalendar();
    initBooking();

    // Ocultar loader
    hideLoader();

    // Avisar si Firebase no está configurado
    if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey === 'TU_API_KEY') {
        showToast('Configurá Firebase en js/config.js para ver los turnos.');
    }

    // Smooth scroll para enlaces
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });
});

/**
 * Oculta el loader inicial
 */
function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('hidden');
    }
}

/**
 * Muestra un toast de notificación
 */
function showToast(message) {
    const toast = document.getElementById('toast');
    const messageEl = document.getElementById('toastMessage');
    
    if (toast && messageEl) {
        messageEl.textContent = message;
        toast.classList.remove('hidden');
        toast.classList.add('visible');

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 4000);
    }
}
