/**
 * Voltron Lab - Lógica del calendario de turnos
 * Muestra mes actual y siguiente, con turnos disponibles y ocupados
 */

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

let currentViewDate = new Date();
let availableSlotsMap = {};
let bookedSlotsMap = {};
let selectedSlot = null;

let unsubscribeSlots = null;

/**
 * Inicializa el calendario con actualización en tiempo real
 */
async function initCalendar() {
    await loadSlotsData();
    renderCalendar();
    setupRealtimeUpdates();
}

/**
 * Configura la suscripción en tiempo real a Firestore.
 * El calendario se actualiza automáticamente cuando hay cambios.
 */
function setupRealtimeUpdates() {
    if (typeof subscribeToSlotsRealtime !== 'function') return;

    unsubscribeSlots = subscribeToSlotsRealtime((availableMap, bookedMap) => {
        availableSlotsMap = availableMap;
        bookedSlotsMap = bookedMap;
        renderCalendar();
    });
}

/**
 * Carga los datos de turnos desde Firestore
 */
async function loadSlotsData() {
    try {
        [availableSlotsMap, bookedSlotsMap] = await Promise.all([
            getAvailableSlotsByDate(),
            getBookedSlotsMap()
        ]);
    } catch (error) {
        console.error('Error cargando turnos:', error);
        showToast('Error al cargar los turnos. Verificá la conexión a Firebase.');
    }
}

/**
 * Renderiza los calendarios del mes actual y siguiente
 */
function renderCalendar() {
    const today = new Date();
    
    // Renderizar mes actual
    renderMonthGrid('calendarGrid', today.getFullYear(), today.getMonth(), '#currentMonthDisplay');
    
    // Renderizar mes siguiente (usando el primer día para evitar problemas con días que no existen)
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    renderMonthGrid('calendarGridNext', nextMonth.getFullYear(), nextMonth.getMonth(), '#nextMonthDisplay');
}

/**
 * Renderiza un mes en el grid especificado
 */
function renderMonthGrid(gridId, year, month, monthDisplayId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    
    // Actualizar display del mes
    const monthDisplay = document.querySelector(monthDisplayId);
    if (monthDisplay) {
        monthDisplay.textContent = `${MONTHS_ES[month]} ${year}`;
    }

    // Primer día del mes y último
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    let html = '';

    // Headers de días
    DAYS_ES.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Días vacíos al inicio
    for (let i = 0; i < startPadding; i++) {
        html += `<div class="calendar-day empty"></div>`;
    }

    // Días del mes
    const today = new Date();
    const todayStr = formatDateId(today);
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isPast = dateStr < todayStr;
        const slots = availableSlotsMap[dateStr] || [];
        const hasAvailable = slots.some(t => !isSlotBookedInMap(dateStr, t));
        const hasOccupied = slots.some(t => isSlotBookedInMap(dateStr, t));

        let dayClass = 'calendar-day';
        if (isPast) dayClass += ' past';
        
        if (slots.length === 0) {
            dayClass += ' empty';
        } else if (hasAvailable) {
            dayClass += ' available';
        } else if (hasOccupied) {
            dayClass += ' occupied';
        }

        if (selectedSlot && selectedSlot.date === dateStr) {
            dayClass += ' selected';
        }

        const slotsHtml = slots.map(time => {
            const booked = isSlotBookedInMap(dateStr, time);
            return `<span class="slot-badge ${booked ? 'occupied' : 'available'}">${time}</span>`;
        }).join('');

        html += `
            <div class="${dayClass}" 
                 data-date="${dateStr}" 
                 data-day="${day}"
                 data-has-slots="${slots.length > 0}"
                 data-has-available="${hasAvailable}">
                <span>${day}</span>
                ${slots.length > 0 ? `<div class="day-slots">${slotsHtml}</div>` : ''}
            </div>
        `;
    }

    grid.innerHTML = html;

    // Event listeners para los días
    grid.querySelectorAll('.calendar-day:not(.empty)').forEach(dayEl => {
        dayEl.addEventListener('click', () => handleDayClick(dayEl));
    });
}

/**
 * Verifica si un turno está ocupado según el mapa cargado
 */
function isSlotBookedInMap(dateStr, timeStr) {
    const key = `${dateStr}_${timeStr.replace(':', '')}`;
    return !!bookedSlotsMap[key];
}

/**
 * Maneja el click en un día
 */
function handleDayClick(dayEl) {
    const dateStr = dayEl.dataset.date;
    const hasAvailable = dayEl.dataset.hasAvailable === 'true';
    const isPast = dayEl.classList.contains('past');

    if (!hasAvailable || isPast) return;

    const slots = availableSlotsMap[dateStr] || [];
    const availableTimes = slots.filter(t => !isSlotBookedInMap(dateStr, t));

    if (availableTimes.length === 0) return;

    selectSlot(dateStr, availableTimes);
}

/**
 * Selecciona un turno y muestra la info
 * Si hay múltiples horarios disponibles, muestra un selector
 */
function selectSlot(dateStr, timeStrOrTimes) {
    const times = Array.isArray(timeStrOrTimes) ? timeStrOrTimes : [timeStrOrTimes];
    const timeStr = times[0];
    
    selectedSlot = { date: dateStr, time: timeStr, availableTimes: times };
    
    const infoEl = document.getElementById('selectedSlotInfo');
    const textEl = document.getElementById('selectedSlotText');
    const timeSelector = document.getElementById('timeSelector');
    const timeSelect = document.getElementById('slotTimeSelect');
    
    if (infoEl && textEl) {
        textEl.textContent = formatDateTime(dateStr, timeStr);
        infoEl.classList.remove('hidden');
        
        if (times.length > 1 && timeSelector && timeSelect) {
            timeSelect.innerHTML = times.map(t => 
                `<option value="${t}" ${t === timeStr ? 'selected' : ''}>${t}</option>`
            ).join('');
            timeSelector.classList.remove('hidden');
            timeSelect.onchange = () => {
                selectedSlot.time = timeSelect.value;
                textEl.textContent = formatDateTime(dateStr, timeSelect.value);
            };
        } else if (timeSelector) {
            timeSelector.classList.add('hidden');
        }
    }

    renderCalendar();
}

/**
 * Limpia la selección
 */
function clearSelection() {
    selectedSlot = null;
    const infoEl = document.getElementById('selectedSlotInfo');
    const timeSelector = document.getElementById('timeSelector');
    if (infoEl) infoEl.classList.add('hidden');
    if (timeSelector) timeSelector.classList.add('hidden');
    renderCalendar();
}

/**
 * Obtiene el turno seleccionado
 */
function getSelectedSlot() {
    return selectedSlot;
}

/**
 * Configura la navegación entre meses
 */
function setupMonthNavigation() {
    document.getElementById('prevMonth')?.addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() - 1);
        clearSelection();
        loadSlotsData().then(renderCalendar);
    });

    document.getElementById('nextMonth')?.addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() + 1);
        clearSelection();
        loadSlotsData().then(renderCalendar);
    });
}
