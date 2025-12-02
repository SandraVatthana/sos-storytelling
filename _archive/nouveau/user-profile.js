/**
 * USER PROFILE MANAGER
 * Gestion du profil utilisateur pour les prompts personnalisés
 */

const USER_PROFILE_KEY = 'voyageCreatifUserProfile';

// Structure par défaut du profil
const DEFAULT_PROFILE = {
    // Identité
    nom: '',
    domaine: '',
    messageUnique: '',
    
    // Audience
    publicCible: [],
    trancheAge: '',
    
    // Contenu
    piliers: [],
    tags: '',
    
    // Plateformes & Formats
    plateformes: [],
    formats: [],
    
    // Profil créateur
    niveau: '',
    style: '',
    
    // Objectifs
    objectif: '',
    problematique: '',
    
    // Libre
    precisions: '',
    
    // Métadonnées
    dateCreation: null,
    dateModification: null
};

/**
 * Récupère le profil utilisateur depuis localStorage
 * @returns {Object|null} Le profil ou null si non existant
 */
function getUserProfile() {
    const saved = localStorage.getItem(USER_PROFILE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('Erreur parsing profil:', e);
            return null;
        }
    }
    return null;
}

/**
 * Sauvegarde le profil utilisateur
 * @param {Object} profile - Le profil à sauvegarder
 */
function saveUserProfile(profile) {
    const now = new Date().toISOString();
    
    // Ajouter les timestamps
    if (!profile.dateCreation) {
        profile.dateCreation = now;
    }
    profile.dateModification = now;
    
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    console.log('✅ Profil sauvegardé:', profile);
}

/**
 * Vérifie si un profil existe et a au moins le nom renseigné
 * @returns {boolean}
 */
function hasValidProfile() {
    const profile = getUserProfile();
    if (!profile) return false;
    
    // Seul le nom est obligatoire
    return profile.nom && profile.nom.trim() !== '';
}

/**
 * Supprime le profil utilisateur
 */
function deleteUserProfile() {
    localStorage.removeItem(USER_PROFILE_KEY);
    console.log('🗑️ Profil supprimé');
}

/**
 * Met à jour partiellement le profil
 * @param {Object} updates - Les champs à mettre à jour
 */
function updateUserProfile(updates) {
    const current = getUserProfile() || { ...DEFAULT_PROFILE };
    const updated = { ...current, ...updates };
    saveUserProfile(updated);
    return updated;
}

/**
 * Formate le profil pour l'affichage
 * @returns {string} Résumé du profil
 */
function getProfileSummary() {
    const profile = getUserProfile();
    if (!profile) return 'Aucun profil configuré';
    
    return `${profile.nom} • ${profile.domaine} • ${profile.plateformes.join(', ')}`;
}

// Export pour utilisation globale
window.UserProfile = {
    get: getUserProfile,
    save: saveUserProfile,
    hasValid: hasValidProfile,
    delete: deleteUserProfile,
    update: updateUserProfile,
    getSummary: getProfileSummary,
    DEFAULT: DEFAULT_PROFILE
};
