/**
 * ONBOARDING SYSTEM V2
 * Formulaire de création/édition du profil utilisateur enrichi
 */

// Options disponibles pour le formulaire
const ONBOARDING_OPTIONS = {
    plateformes: [
        { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
        { value: 'instagram', label: 'Instagram', icon: '📸' },
        { value: 'tiktok', label: 'TikTok', icon: '🎵' },
        { value: 'youtube', label: 'YouTube', icon: '🎬' },
        { value: 'x', label: 'X (Twitter)', icon: '𝕏' },
        { value: 'facebook', label: 'Facebook', icon: '👥' },
        { value: 'threads', label: 'Threads', icon: '🧵' },
        { value: 'pinterest', label: 'Pinterest', icon: '📌' },
        { value: 'newsletter', label: 'Newsletter', icon: '📧' }
    ],
    formats: [
        { value: 'post', label: 'Post texte', icon: '📝' },
        { value: 'carousel', label: 'Carousel', icon: '🎠' },
        { value: 'reel', label: 'Reel / Vidéo courte', icon: '🎬' },
        { value: 'story', label: 'Story', icon: '⏱️' },
        { value: 'thread', label: 'Thread', icon: '🧵' },
        { value: 'live', label: 'Live', icon: '🔴' },
        { value: 'article', label: 'Article long', icon: '📰' },
        { value: 'visuel', label: 'Visuel / Infographie', icon: '🎨' }
    ],
    publicCible: [
        { value: 'entrepreneurs', label: 'Entrepreneurs', icon: '🚀' },
        { value: 'freelances', label: 'Freelances', icon: '💻' },
        { value: 'salaries', label: 'Salariés', icon: '👔' },
        { value: 'etudiants', label: 'Étudiants', icon: '🎓' },
        { value: 'createurs', label: 'Créateurs', icon: '🎨' },
        { value: 'rh', label: 'RH / Recruteurs', icon: '🤝' },
        { value: 'b2b', label: 'Pros / B2B', icon: '🏢' },
        { value: 'b2c', label: 'Grand public', icon: '🛒' },
        { value: 'dirigeants', label: 'Dirigeants', icon: '👑' }
    ],
    trancheAge: [
        { value: '18-25', label: '18-25 ans', description: 'Gen Z' },
        { value: '25-35', label: '25-35 ans', description: 'Millennials jeunes' },
        { value: '35-45', label: '35-45 ans', description: 'Millennials confirmés' },
        { value: '45-55', label: '45-55 ans', description: 'Gen X' },
        { value: '55+', label: '55+ ans', description: 'Boomers' },
        { value: 'tous', label: 'Tous âges', description: 'Pas de cible spécifique' }
    ],
    niveaux: [
        { value: 'debutant', label: 'Jeune pousse', description: 'Je découvre les réseaux sociaux', icon: '🌱' },
        { value: 'explorateur', label: 'Explorateur', description: 'Je teste différentes approches', icon: '🧭' },
        { value: 'createur', label: 'Créateur', description: 'Je publie régulièrement', icon: '✨' },
        { value: 'influenceur', label: 'Influenceur', description: 'J\'ai une communauté engagée', icon: '🚀' },
        { value: 'stratege', label: 'Stratège', description: 'Je maîtrise ma stratégie', icon: '💎' },
        { value: 'legende', label: 'Légende', description: 'Je suis une référence', icon: '👑' }
    ],
    styles: [
        { value: 'inspirant', label: 'Inspirant', description: 'Vision, motivation', icon: '✨' },
        { value: 'educatif', label: 'Éducatif', description: 'Conseils, tutoriels', icon: '📚' },
        { value: 'authentique', label: 'Authentique', description: 'Vulnérabilité, transparence', icon: '💎' },
        { value: 'humour', label: 'Humour', description: 'Légèreté, décalé', icon: '😄' },
        { value: 'provocateur', label: 'Provocateur', description: 'Challenge les codes', icon: '🔥' },
        { value: 'minimaliste', label: 'Minimaliste', description: 'Court, percutant', icon: '🎯' },
        { value: 'storytelling', label: 'Storytelling', description: 'Histoires et récits', icon: '📖' },
        { value: 'emotionnel', label: 'Émotionnel', description: 'Toucher le cœur', icon: '❤️' }
    ],
    objectifs: [
        { value: 'notoriete', label: 'Notoriété', description: 'Être reconnu·e', icon: '🌟' },
        { value: 'communaute', label: 'Communauté', description: 'Créer une tribu', icon: '👥' },
        { value: 'ventes', label: 'Ventes', description: 'Convertir', icon: '💰' },
        { value: 'autorite', label: 'Autorité', description: 'Devenir LA référence', icon: '👑' },
        { value: 'reseau', label: 'Réseau', description: 'Développer mes connexions', icon: '🤝' },
        { value: 'expression', label: 'Expression', description: 'Partager ma vision', icon: '🎨' },
        { value: 'recrutement', label: 'Recrutement', description: 'Attirer des talents', icon: '🎯' },
        { value: 'validation', label: 'Validation', description: 'Tester une idée', icon: '🧪' }
    ]
};

/**
 * Affiche le modal d'onboarding
 * @param {boolean} isEdit - Mode édition (true) ou création (false)
 */
function showOnboarding(isEdit = false) {
    const existingProfile = UserProfile.get();
    
    const modalHTML = `
        <div id="onboardingOverlay" class="onboarding-overlay">
            <div class="onboarding-modal">
                <div class="onboarding-header">
                    <h2>${isEdit ? '✏️ Modifier mon profil' : '🚀 Bienvenue !'}</h2>
                    <p>${isEdit ? 'Tes contenus seront personnalisés selon ces informations' : 'Personnalise ton expérience en quelques clics'}</p>
                    <button class="onboarding-close" onclick="closeOnboarding()">×</button>
                </div>
                
                <form id="onboardingForm" class="onboarding-form">
                    
                    <!-- SECTION 1 : Identité -->
                    <div class="onboarding-section">
                        <h3>👤 Ton identité</h3>
                        
                        <div class="form-group">
                            <label for="onb-nom">Comment t'appelles-tu ? <span class="required">*</span></label>
                            <input type="text" id="onb-nom" placeholder="Ton prénom ou pseudo" 
                                   value="${existingProfile?.nom || ''}" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="onb-domaine">Ton domaine d'expertise</label>
                            <input type="text" id="onb-domaine" placeholder="Ex: coaching, design, marketing digital..." 
                                   value="${existingProfile?.domaine || ''}">
                        </div>
                        
                        <div class="form-group">
                            <label for="onb-messageUnique">Ce qui te rend unique (ton message clé)</label>
                            <textarea id="onb-messageUnique" placeholder="Ex: J'aide les introvertis à rayonner sur LinkedIn sans s'épuiser..." 
                                   style="min-height: 60px;">${existingProfile?.messageUnique || ''}</textarea>
                        </div>
                    </div>
                    
                    <!-- SECTION 2 : Audience -->
                    <div class="onboarding-section">
                        <h3>🎯 Ton audience</h3>
                        <p class="section-hint">Qui veux-tu toucher avec ton contenu ?</p>
                        
                        <div class="form-group">
                            <label>Public cible</label>
                            <div class="checkbox-grid checkbox-grid-compact">
                                ${ONBOARDING_OPTIONS.publicCible.map(p => `
                                    <label class="checkbox-card">
                                        <input type="checkbox" name="publicCible" value="${p.value}" 
                                               ${existingProfile?.publicCible?.includes(p.value) ? 'checked' : ''}>
                                        <span class="checkbox-content">
                                            <span class="checkbox-icon">${p.icon}</span>
                                            <span class="checkbox-label">${p.label}</span>
                                        </span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Tranche d'âge de ton audience</label>
                            <div class="radio-cards radio-cards-3col">
                                ${ONBOARDING_OPTIONS.trancheAge.map(t => `
                                    <label class="radio-card radio-card-compact">
                                        <input type="radio" name="trancheAge" value="${t.value}" 
                                               ${(existingProfile?.trancheAge || '') === t.value ? 'checked' : ''}>
                                        <span class="radio-content">
                                            <span class="radio-label">${t.label}</span>
                                        </span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- SECTION 3 : Contenu -->
                    <div class="onboarding-section">
                        <h3>📝 Ton contenu</h3>
                        
                        <div class="form-group">
                            <label for="onb-piliers">Tes piliers de contenu (2-4 thématiques)</label>
                            <input type="text" id="onb-piliers" placeholder="Ex: mindset, productivité, entrepreneuriat" 
                                   value="${existingProfile?.piliers?.join(', ') || ''}">
                            <small>Séparés par des virgules</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="onb-tags">Tags / mots-clés récurrents</label>
                            <input type="text" id="onb-tags" placeholder="Ex: #leadership #growthmindset #solopreneur" 
                                   value="${existingProfile?.tags || ''}">
                            <small>Les hashtags ou mots que tu utilises souvent</small>
                        </div>
                    </div>
                    
                    <!-- SECTION 4 : Plateformes & Formats -->
                    <div class="onboarding-section">
                        <h3>📱 Tes plateformes & formats</h3>
                        
                        <div class="form-group">
                            <label>Où publies-tu ?</label>
                            <div class="checkbox-grid">
                                ${ONBOARDING_OPTIONS.plateformes.map(p => `
                                    <label class="checkbox-card">
                                        <input type="checkbox" name="plateformes" value="${p.value}" 
                                               ${existingProfile?.plateformes?.includes(p.value) ? 'checked' : ''}>
                                        <span class="checkbox-content">
                                            <span class="checkbox-icon">${p.icon}</span>
                                            <span class="checkbox-label">${p.label}</span>
                                        </span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Formats préférés</label>
                            <div class="checkbox-grid">
                                ${ONBOARDING_OPTIONS.formats.map(f => `
                                    <label class="checkbox-card">
                                        <input type="checkbox" name="formats" value="${f.value}" 
                                               ${existingProfile?.formats?.includes(f.value) ? 'checked' : ''}>
                                        <span class="checkbox-content">
                                            <span class="checkbox-icon">${f.icon}</span>
                                            <span class="checkbox-label">${f.label}</span>
                                        </span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- SECTION 5 : Profil créateur -->
                    <div class="onboarding-section">
                        <h3>✨ Ton profil créateur</h3>
                        
                        <div class="form-group">
                            <label>Ton niveau d'expérience</label>
                            <div class="radio-cards radio-cards-3col">
                                ${ONBOARDING_OPTIONS.niveaux.map(n => `
                                    <label class="radio-card">
                                        <input type="radio" name="niveau" value="${n.value}" 
                                               ${(existingProfile?.niveau || '') === n.value ? 'checked' : ''}>
                                        <span class="radio-content">
                                            <span class="radio-icon">${n.icon}</span>
                                            <span class="radio-label">${n.label}</span>
                                        </span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Ton style de communication</label>
                            <div class="radio-cards radio-cards-2col">
                                ${ONBOARDING_OPTIONS.styles.map(s => `
                                    <label class="radio-card">
                                        <input type="radio" name="style" value="${s.value}" 
                                               ${(existingProfile?.style || '') === s.value ? 'checked' : ''}>
                                        <span class="radio-content">
                                            <span class="radio-icon">${s.icon}</span>
                                            <span class="radio-label">${s.label}</span>
                                            <span class="radio-desc">${s.description}</span>
                                        </span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- SECTION 6 : Objectifs -->
                    <div class="onboarding-section">
                        <h3>🎯 Tes objectifs</h3>
                        
                        <div class="form-group">
                            <label>Ton objectif principal</label>
                            <div class="radio-cards radio-cards-2col">
                                ${ONBOARDING_OPTIONS.objectifs.map(o => `
                                    <label class="radio-card">
                                        <input type="radio" name="objectif" value="${o.value}" 
                                               ${(existingProfile?.objectif || '') === o.value ? 'checked' : ''}>
                                        <span class="radio-content">
                                            <span class="radio-icon">${o.icon}</span>
                                            <span class="radio-label">${o.label}</span>
                                            <span class="radio-desc">${o.description}</span>
                                        </span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="onb-problematique">Ta problématique ou ambition actuelle</label>
                            <textarea id="onb-problematique" placeholder="Ex: Je bloque sur la régularité de publication... / Je veux lancer ma formation en janvier..." 
                                   style="min-height: 60px;">${existingProfile?.problematique || ''}</textarea>
                        </div>
                    </div>
                    
                    <!-- SECTION 7 : Précisions libres -->
                    <div class="onboarding-section">
                        <h3>💬 Autre chose ?</h3>
                        
                        <div class="form-group">
                            <textarea id="onb-precisions" placeholder="Tout ce qui peut aider à personnaliser tes contenus : contraintes, ton de marque, anecdotes, etc." 
                                   style="min-height: 80px;">${existingProfile?.precisions || ''}</textarea>
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="onboarding-actions">
                        <button type="submit" class="btn-primary">
                            ${isEdit ? '💾 Sauvegarder' : '🚀 C\'est parti !'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Gérer la soumission du formulaire
    document.getElementById('onboardingForm').addEventListener('submit', handleOnboardingSubmit);
    
    // Animation d'entrée
    setTimeout(() => {
        document.getElementById('onboardingOverlay').classList.add('active');
    }, 10);
}

/**
 * Gère la soumission du formulaire d'onboarding
 */
function handleOnboardingSubmit(e) {
    e.preventDefault();
    
    // Récupérer les valeurs
    const nom = document.getElementById('onb-nom').value.trim();
    
    // Seul le nom est obligatoire
    if (!nom) {
        alert('Merci de renseigner au moins ton prénom 😊');
        return;
    }
    
    const domaine = document.getElementById('onb-domaine').value.trim();
    const messageUnique = document.getElementById('onb-messageUnique').value.trim();
    const piliers = document.getElementById('onb-piliers').value.split(',').map(p => p.trim()).filter(p => p);
    const tags = document.getElementById('onb-tags').value.trim();
    const problematique = document.getElementById('onb-problematique').value.trim();
    const precisions = document.getElementById('onb-precisions').value.trim();
    
    // Checkboxes
    const plateformes = Array.from(document.querySelectorAll('input[name="plateformes"]:checked')).map(cb => cb.value);
    const formats = Array.from(document.querySelectorAll('input[name="formats"]:checked')).map(cb => cb.value);
    const publicCible = Array.from(document.querySelectorAll('input[name="publicCible"]:checked')).map(cb => cb.value);
    
    // Radios
    const trancheAge = document.querySelector('input[name="trancheAge"]:checked')?.value || '';
    const niveau = document.querySelector('input[name="niveau"]:checked')?.value || '';
    const style = document.querySelector('input[name="style"]:checked')?.value || '';
    const objectif = document.querySelector('input[name="objectif"]:checked')?.value || '';
    
    // Sauvegarder le profil
    const profile = {
        nom,
        domaine,
        messageUnique,
        piliers,
        tags,
        publicCible,
        trancheAge,
        plateformes,
        formats,
        niveau,
        style,
        objectif,
        problematique,
        precisions
    };
    
    UserProfile.save(profile);
    
    // Fermer le modal
    closeOnboarding();
    
    // Mettre à jour le bouton profil
    updateProfileButton();
    
    // Notification de succès
    showNotification(`✨ Profil sauvegardé, ${nom} !`);
}

/**
 * Ferme le modal d'onboarding
 */
function closeOnboarding() {
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    }
}

/**
 * Ouvre l'onboarding en mode édition
 */
function editProfile() {
    showOnboarding(true);
}

/**
 * Vérifie si l'onboarding doit être affiché
 */
function checkOnboarding() {
    if (!UserProfile.hasValid()) {
        showOnboarding(false);
    } else {
        updateProfileButton();
    }
}

/**
 * Met à jour le bouton profil dans le header
 */
function updateProfileButton() {
    const btn = document.getElementById('profileBtn');
    if (btn) {
        const profile = UserProfile.get();
        if (profile && profile.nom) {
            btn.innerHTML = '✏️ Éditer profil';
            btn.title = `Profil : ${profile.nom}${profile.domaine ? ' • ' + profile.domaine : ''}`;
            btn.style.display = 'inline-flex';
        }
    }
}

/**
 * Affiche une notification toast
 */
function showNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'onboarding-notif';
    notif.innerHTML = message;
    document.body.appendChild(notif);
    
    setTimeout(() => notif.classList.add('active'), 10);
    setTimeout(() => {
        notif.classList.remove('active');
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

/**
 * Force l'affichage de l'onboarding (pour le bouton édition)
 */
function forceShowOnboarding() {
    showOnboarding(true);
}

// Export global
window.Onboarding = {
    show: showOnboarding,
    close: closeOnboarding,
    edit: editProfile,
    check: checkOnboarding,
    forceShow: forceShowOnboarding
};
