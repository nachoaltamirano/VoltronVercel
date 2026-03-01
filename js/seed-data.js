/**
 * Voltron Lab - Script para cargar datos de ejemplo
 * Ejecutar desde la consola del navegador (F12) estando logueado como admin.
 * 
 * Uso: copiar y pegar en la consola, o importar y llamar seedSampleData()
 */

async function seedSampleData() {
    if (!firebase.auth().currentUser) {
        console.error('Debés estar logueado como admin para ejecutar el seed.');
        return;
    }

    const db = firebase.firestore();
    const slots = [
        { date: '2025-03-05', time: '09:00' },
        { date: '2025-03-05', time: '10:00' },
        { date: '2025-03-05', time: '11:00' },
        { date: '2025-03-10', time: '09:00' },
        { date: '2025-03-10', time: '14:00' },
        { date: '2025-03-15', time: '10:00' },
        { date: '2025-03-15', time: '11:00' },
        { date: '2025-03-20', time: '09:00' },
        { date: '2025-03-25', time: '15:00' },
        { date: '2025-04-01', time: '10:00' },
        { date: '2025-04-05', time: '11:00' },
    ];

    for (const slot of slots) {
        const id = `${slot.date}_${slot.time.replace(':', '')}`;
        await db.collection('availableSlots').doc(id).set({
            date: slot.date,
            time: slot.time,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('Creado:', id);
    }

    console.log('✓ Datos de ejemplo cargados correctamente.');
}
