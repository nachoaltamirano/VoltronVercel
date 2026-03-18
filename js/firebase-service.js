/**
 * Voltron Lab - Servicio de Firebase
 * Maneja todas las operaciones con Firestore y Authentication
 */

// Inicializar Firebase (solo si está configurado)
let db, auth, availableSlotsRef, bookedSlotsRef, appointmentsRef, blockPatternsRef;

const config = typeof firebaseConfig !== 'undefined' ? firebaseConfig : (window.firebaseConfig || {});
if (config.apiKey && config.apiKey !== 'TU_API_KEY') {
    firebase.initializeApp(config);
    db = firebase.firestore();
    auth = firebase.auth();
    availableSlotsRef = db.collection('availableSlots');
    bookedSlotsRef = db.collection('bookedSlots');
    appointmentsRef = db.collection('appointments');
    blockPatternsRef = db.collection('blockPatterns');
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
    if (!availableSlotsRef || !bookedSlotsRef || !appointmentsRef || !blockPatternsRef) return () => {};

    let debounceTimer = null;
    const loadData = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            Promise.all([
                getAvailableSlots(),
                getBookedSlots(),
                getAppointments(),
                getBlockPatterns()
            ]).then(([available, booked, appointments, blockPatterns]) => callback({ available, booked, appointments, blockPatterns }));
        }, 150);
    };

    const unsubAvailable = availableSlotsRef.onSnapshot(() => loadData());
    const unsubBooked = bookedSlotsRef.onSnapshot(() => loadData());
    const unsubAppointments = appointmentsRef.onSnapshot(() => loadData());
    const unsubPatterns = blockPatternsRef.onSnapshot(() => loadData());

    return () => {
        clearTimeout(debounceTimer);
        unsubAvailable();
        unsubBooked();
        unsubAppointments();
        unsubPatterns();
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
    if (!availableSlotsRef || !bookedSlotsRef) {
        const err = new Error('Firebase no configurado - refs faltando');
        console.error('ERROR:', err, { availableSlotsRef: !!availableSlotsRef, bookedSlotsRef: !!bookedSlotsRef });
        throw err;
    }
    
    const slotId = `${dateStr}_${timeStr.replace(':', '')}`;
    
    try {
        // Eliminar de disponibles
        console.log(`  - Eliminando ${slotId} de availableSlots...`);
        await availableSlotsRef.doc(slotId).delete();
        console.log(`  ✓ Eliminado de availableSlots`);
        
        // Agregar a ocupados
        console.log(`  - Agregando ${slotId} a bookedSlots...`);
        await bookedSlotsRef.doc(slotId).set({
            date: dateStr,
            time: timeStr,
            appointmentId: appointmentData.id,
            bookedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`  ✓ Agregado a bookedSlots`);
    } catch (error) {
        console.error(`❌ Error marcando slot ${slotId} como booked:`, error);
        throw error;
    }
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
 * Revierte una cita (la elimina y libera el turno)
 */
async function revertAppointment(appointmentId, dateStr, timeStr) {
    if (!appointmentsRef || !bookedSlotsRef || !availableSlotsRef) throw new Error('Firebase no configurado');
    
    // Calcular el slotId basado en fecha y hora
    const slotId = `${dateStr}_${timeStr.replace(':', '')}`;
    
    try {
        // Eliminar la cita
        await appointmentsRef.doc(appointmentId).delete();
        
        // Eliminar de bookedSlots
        await bookedSlotsRef.doc(slotId).delete();
        
        // Crear en availableSlots
        await createAvailableSlot(dateStr, timeStr);
    } catch (error) {
        console.error('Error revertiendo cita:', error);
        throw error;
    }
}

/**
 * Marca manualmente un turno como ocupado - solo admin
 * (sin crear appointment, para casos especiales)
 */
async function markSlotAsOccupiedManually(dateStr, timeStr) {
    if (!availableSlotsRef || !bookedSlotsRef) throw new Error('Firebase no configurado');
    const slotId = `${dateStr}_${timeStr.replace(':', '')}`;
    
    // Si el turno está en disponibles, eliminarlo primero
    const availableDoc = await availableSlotsRef.doc(slotId).get();
    if (availableDoc.exists) {
        await availableSlotsRef.doc(slotId).delete();
    }
    
    // Agregar a ocupados
    await bookedSlotsRef.doc(slotId).set({
        date: dateStr,
        time: timeStr,
        manual: true,
        bookedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Crea permanentemente un turno bloqueado (ocupado) - solo admin
 * Se crea directamente en bookedSlots sin pasar por availableSlots
 */
async function createBlockedSlot(dateStr, timeStr) {
    if (!bookedSlotsRef) throw new Error('Firebase no configurado');
    const slotId = `${dateStr}_${timeStr.replace(':', '')}`;
    
    // Primero verificar si ya existe
    const existingDoc = await bookedSlotsRef.doc(slotId).get();
    if (existingDoc.exists) {
        throw new Error('Este turno ya está bloqueado o reservado');
    }
    
    await bookedSlotsRef.doc(slotId).set({
        date: dateStr,
        time: timeStr,
        blocked: true,
        blockedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Crea una reserva (appointment) y marca el turno como ocupado
 */
async function createAppointment(dateStr, timeStr, patientData) {
    if (!appointmentsRef) {
        const err = new Error('Firebase no configurado - appointmentsRef es null');
        console.error('ERROR:', err);
        throw err;
    }
    
    try {
        console.log('1️⃣ Creando documento en appointments...');
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
        console.log('✅ Documento creado:', docRef.id);

        console.log('2️⃣ Marcando turno como ocupado...');
        await markSlotAsBooked(dateStr, timeStr, { id: docRef.id });
        console.log('✅ Turno marcado como ocupado');
        
        return docRef.id;
    } catch (error) {
        console.error('❌ Error en createAppointment:', error);
        console.error('Detalles del error:', {
            code: error.code,
            message: error.message,
            dateStr,
            timeStr,
            patientData: (({ nombre, telefono, email, motivo }) => ({ nombre, telefono, email, motivo }))(patientData)
        });
        throw error;
    }
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

/**
 * Crea un patrón de bloqueo recurrente (ej: todos los martes de 16 a 17)
 */
async function createBlockPattern(dayOfWeek, startTime, endTime, reason) {
    if (!blockPatternsRef) throw new Error('Firebase no configurado');
    
    await blockPatternsRef.add({
        dayOfWeek: dayOfWeek,  // 0=lunes, 1=martes, ..., 6=domingo
        startTime: startTime,
        endTime: endTime,
        reason: reason,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Obtiene todos los patrones de bloqueo
 */
async function getBlockPatterns() {
    if (!blockPatternsRef) return [];
    const snapshot = await blockPatternsRef.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Elimina un patrón de bloqueo
 */
async function deleteBlockPattern(patternId) {
    if (!blockPatternsRef) throw new Error('Firebase no configurado');
    await blockPatternsRef.doc(patternId).delete();
}

/**
 * Verifica si una fecha y hora están dentro de un patrón de bloqueo
 * Retorna true si está bloqueada
 */
async function isTimeInBlockPattern(dateStr, timeStr) {
    const patterns = await getBlockPatterns();
    if (!patterns || patterns.length === 0) return false;
    
    // Obtener el día de la semana (0=domingo, 1=lunes, ..., 6=sábado en JS)
    // Pero nuestro sistema usa 0=lunes, así que ajustamos
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    let dayOfWeek = date.getDay();
    dayOfWeek = (dayOfWeek + 6) % 7;  // Convertir: domingo(0) -> 6, lunes(1) -> 0, etc.
    
    // Verificar si la hora está dentro de algún patrón
    for (let pattern of patterns) {
        if (pattern.dayOfWeek === dayOfWeek) {
            if (timeStr >= pattern.startTime && timeStr < pattern.endTime) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Suscripción en tiempo real para bloqueos recurrentes
 */
function subscribeToBlockPatternsRealtime(callback) {
    if (!blockPatternsRef) return () => {};
    
    return blockPatternsRef.onSnapshot((snapshot) => {
        const patterns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(patterns);
    });
}
