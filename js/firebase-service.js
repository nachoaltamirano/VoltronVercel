/**
 * Voltron Lab - Servicio de Firebase
 * Maneja todas las operaciones con Firestore y Authentication
 */

// Inicializar Firebase (solo si está configurado)
let db, auth, availableSlotsRef, bookedSlotsRef, appointmentsRef;

const config = typeof firebaseConfig !== 'undefined' ? firebaseConfig : (window.firebaseConfig || {});
if (config.apiKey && config.apiKey !== 'TU_API_KEY') {
    firebase.initializeApp(config);
    db = firebase.firestore();
    auth = firebase.auth();
    availableSlotsRef = db.collection('availableSlots');
    bookedSlotsRef = db.collection('bookedSlots');
    appointmentsRef = db.collection('appointments');
} else {
    console.warn('Voltron Lab: Configurá Firebase en js/config.js para usar el sitio.');
}

/**
 * Formatea una fecha para usar como ID (YYYY-MM-DD)
 */
function formatDateId(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Formatea fecha y hora para mostrar
 */
function formatDateTime(dateStr, timeStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const formatted = date.toLocaleDateString('es-AR', options);
    return `${formatted} a las ${timeStr}`;
}

/**
 * Obtiene todos los turnos disponibles
 */
async function getAvailableSlots() {
    if (!availableSlotsRef) return [];
    const snapshot = await availableSlotsRef.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Obtiene todos los turnos ocupados
 */
async function getBookedSlots() {
    if (!bookedSlotsRef) return [];
    const snapshot = await bookedSlotsRef.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Obtiene todas las reservas (appointments)
 */
async function getAppointments() {
    if (!appointmentsRef) return [];
    const snapshot = await appointmentsRef.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Verifica si un turno está ocupado
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD
 * @param {string} timeStr - Hora en formato HH:MM
 */
async function isSlotBooked(dateStr, timeStr) {
    if (!bookedSlotsRef) return false;
    const slotId = `${dateStr}_${timeStr.replace(':', '')}`;
    const doc = await bookedSlotsRef.doc(slotId).get();
    return doc.exists;
}

/**
 * Obtiene el mapa de turnos ocupados para un rango de fechas
 */
async function getBookedSlotsMap() {
    const booked = await getBookedSlots();
    const map = {};
    booked.forEach(slot => {
        const key = `${slot.date}_${slot.time.replace(':', '')}`;
        map[key] = true;
    });
    return map;
}

/**
 * Obtiene el mapa de turnos disponibles por fecha
 * Retorna: { "2025-03-15": ["09:00", "10:00"], ... }
 */
async function getAvailableSlotsByDate() {
    const available = await getAvailableSlots();
    const map = {};
    available.forEach(slot => {
        if (!map[slot.date]) map[slot.date] = [];
        map[slot.date].push(slot.time);
    });
    return map;
}

/**
 * Construye los mapas desde snapshots de Firestore (evita caché)
 */
function buildMapsFromSnapshots(availableSnapshot, bookedSnapshot) {
    const availableMap = {};
    availableSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!availableMap[data.date]) availableMap[data.date] = [];
        availableMap[data.date].push(data.time);
    });
    const bookedMap = {};
    bookedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const key = `${data.date}_${data.time.replace(':', '')}`;
        bookedMap[key] = true;
    });
    return { availableMap, bookedMap };
}

/**
 * Suscripción en tiempo real a cambios en turnos disponibles y ocupados.
 * Usa los datos del snapshot directamente para evitar caché desactualizado.
 */
function subscribeToSlotsRealtime(callback) {
    if (!availableSlotsRef || !bookedSlotsRef) return () => {};

    let lastAvailable = null;
    let lastBooked = null;

    const updateFromSnapshots = () => {
        if (lastAvailable && lastBooked) {
            const { availableMap, bookedMap } = buildMapsFromSnapshots(lastAvailable, lastBooked);
            callback(availableMap, bookedMap);
        }
    };

    const unsubAvailable = availableSlotsRef.onSnapshot((snapshot) => {
        lastAvailable = snapshot;
        updateFromSnapshots();
    });
    const unsubBooked = bookedSlotsRef.onSnapshot((snapshot) => {
        lastBooked = snapshot;
        updateFromSnapshots();
    });

    return () => {
        unsubAvailable();
        unsubBooked();
    };
}

/**
 * Suscripción en tiempo real para el panel admin.
 * Escucha cambios en availableSlots, bookedSlots y appointments.
 * Retorna función para cancelar.
 */
function subscribeToAdminDataRealtime(callback) {
    if (!availableSlotsRef || !bookedSlotsRef || !appointmentsRef) return () => {};

    let debounceTimer = null;
    const loadData = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            Promise.all([
                getAvailableSlots(),
                getBookedSlots(),
                getAppointments()
            ]).then(([available, booked, appointments]) => callback({ available, booked, appointments }));
        }, 150);
    };

    const unsubAvailable = availableSlotsRef.onSnapshot(() => loadData());
    const unsubBooked = bookedSlotsRef.onSnapshot(() => loadData());
    const unsubAppointments = appointmentsRef.onSnapshot(() => loadData());

    return () => {
        clearTimeout(debounceTimer);
        unsubAvailable();
        unsubBooked();
        unsubAppointments();
    };
}

/**
 * Crea un nuevo turno disponible (solo admin)
 */
async function createAvailableSlot(dateStr, timeStr) {
    if (!availableSlotsRef) throw new Error('Firebase no configurado');
    const slotId = `${dateStr}_${timeStr.replace(':', '')}`;
    await availableSlotsRef.doc(slotId).set({
        date: dateStr,
        time: timeStr,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return slotId;
}

/**
 * Elimina un turno disponible (solo admin)
 */
async function deleteAvailableSlot(slotId) {
    if (!availableSlotsRef) throw new Error('Firebase no configurado');
    await availableSlotsRef.doc(slotId).delete();
}

/**
 * Marca un turno como ocupado (mover de available a booked)
 */
async function markSlotAsBooked(dateStr, timeStr, appointmentData) {
    if (!availableSlotsRef || !bookedSlotsRef) throw new Error('Firebase no configurado');
    const slotId = `${dateStr}_${timeStr.replace(':', '')}`;
    
    // Eliminar de disponibles
    await availableSlotsRef.doc(slotId).delete();
    
    // Agregar a ocupados
    await bookedSlotsRef.doc(slotId).set({
        date: dateStr,
        time: timeStr,
        appointmentId: appointmentData.id,
        bookedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Libera un turno (mover de booked a available) - solo admin
 */
async function releaseSlot(slotId) {
    if (!bookedSlotsRef || !availableSlotsRef) throw new Error('Firebase no configurado');
    const slotDoc = await bookedSlotsRef.doc(slotId).get();
    if (!slotDoc.exists) throw new Error('Turno no encontrado');
    
    const { date, time } = slotDoc.data();
    
    await bookedSlotsRef.doc(slotId).delete();
    await createAvailableSlot(date, time);
}

/**
 * Marca manualmente un turno como ocupado - solo admin
 * (sin crear appointment, para casos especiales)
 */
async function markSlotAsOccupiedManually(dateStr, timeStr) {
    if (!availableSlotsRef || !bookedSlotsRef) throw new Error('Firebase no configurado');
    const slotId = `${dateStr}_${timeStr.replace(':', '')}`;
    await availableSlotsRef.doc(slotId).delete();
    await bookedSlotsRef.doc(slotId).set({
        date: dateStr,
        time: timeStr,
        manual: true,
        bookedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Crea una reserva (appointment) y marca el turno como ocupado
 */
async function createAppointment(dateStr, timeStr, patientData) {
    if (!appointmentsRef) throw new Error('Firebase no configurado');
    const docRef = await appointmentsRef.add({
        date: dateStr,
        time: timeStr,
        patientName: patientData.nombre,
        patientPhone: patientData.telefono,
        patientEmail: patientData.email || '',
        reason: patientData.motivo,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'confirmed'
    });

    await markSlotAsBooked(dateStr, timeStr, { id: docRef.id });
    
    return docRef.id;
}

/**
 * Login de administrador
 */
async function adminLogin(email, password) {
    if (!auth) throw new Error('Firebase no configurado');
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
}

/**
 * Logout
 */
async function adminLogout() {
    if (auth) await auth.signOut();
}

/**
 * Verifica si hay un usuario autenticado
 */
function getCurrentUser() {
    return auth ? auth.currentUser : null;
}

/**
 * Escucha cambios en el estado de autenticación
 */
function onAuthStateChanged(callback) {
    if (!auth) {
        callback(null);
        return () => {};
    }
    return auth.onAuthStateChanged(callback);
}
