/**
 * Configuración de Firebase para Voltron Lab
 * 
 * IMPORTANTE: Reemplazá estos valores con los de tu proyecto Firebase.
 * 1. Creá un proyecto en https://console.firebase.google.com
 * 2. Habilitá Firestore y Authentication (Email/Password)
 * 3. Copiá las credenciales aquí
 */

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBiDTlBSEV1-hAfbLE-92sm0qPKtg23Xr0",
    authDomain: "voltron-lab.firebaseapp.com",
    projectId: "voltron-lab",
    storageBucket: "voltron-lab.firebasestorage.app",
    messagingSenderId: "527362549771",
    appId: "1:527362549771:web:fe285c27b581eed2e9ff0e",
    measurementId: "G-CNN75RSLMS"
};
// Asegurar que esté disponible globalmente para firebase-service.js
window.firebaseConfig = firebaseConfig;

// Número de WhatsApp del dueño (para envío de notificaciones)
// Formato: código de país + número sin espacios ni guiones
const WHATSAPP_NUMBER = "5491178285874";
