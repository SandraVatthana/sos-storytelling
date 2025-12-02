// INITIALISATION DU JEU
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Configuration API - MODIFIE CES VALEURS
const API_CONFIG = {
    // Option 1: Clé API directe (pour test uniquement)
    apiKey: null,
    
    // Option 2: URL du Worker Cloudflare (pour production)
    workerUrl: "https://voyage-creatif-api.sandra-devonssay.workers.dev",
    
    // Si workerUrl est défini, il sera utilisé en priorité
    useWorker: true // Utilise le Worker Cloudflare
};

let gameState = {
    currentPosition: 0,
    unlockedCases: [0],
    visitedCases: [],
    challengesCompleted: 0,
    lastRewardAt: 0
};

// Conversation state for current case
let currentConversation = {
    messages: [],
    questionsRemaining: 2,
    currentCaseIndex: null
};

// GESTION DU STOCKAGE LOCAL
function loadGameState() {
    const saved = localStorage.getItem('voyageCreativiteRS');
    if (saved) {
        gameState = JSON.parse(saved);
    }
}

function saveGameState() {
    localStorage.setItem('voyageCreativiteRS', JSON.stringify(gameState));
}

// FONCTIONS AUDIO
function playSound(frequency, duration, type = 'sine') {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playPopSound() {
    playSound(800, 0.05, 'sine');
    setTimeout(() => playSound(1200, 0.05, 'sine'), 20);
    setTimeout(() => playSound(600, 0.08, 'sine'), 40);
}

function playHourraSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sawtooth';
    
    oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.6);
    
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.6);
}

function playCelebrationSound() {
    playSound(523.25, 0.1);
    setTimeout(() => playSound(659.25, 0.1), 80);
    setTimeout(() => playSound(783.99, 0.1), 160);
    setTimeout(() => playSound(1046.50, 0.15), 240);
    setTimeout(() => playSound(1318.51, 0.2), 320);
    
    setTimeout(() => playPopSound(), 100);
    setTimeout(() => playPopSound(), 200);
    setTimeout(() => playPopSound(), 300);
    
    setTimeout(() => playHourraSound(), 150);
}

function playSuccessSound() {
    playSound(523.25, 0.2);
    setTimeout(() => playSound(659.25, 0.2), 100);
    setTimeout(() => playSound(783.99, 0.3), 200);
}

function playUnlockSound() {
    playSound(440, 0.15);
    setTimeout(() => playSound(554.37, 0.2), 80);
}

function playRewardSound() {
    playSound(523.25, 0.15);
    setTimeout(() => playSound(659.25, 0.15), 100);
    setTimeout(() => playSound(783.99, 0.15), 200);
    setTimeout(() => playSound(1046.50, 0.3), 300);
}

// FONCTION CONFETTI
function createConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#30cfd0', '#fa709a', '#fee140', '#4facfe'];
    const confettiCount = 80;
    const confettiParticles = [];
    
    for (let i = 0; i < confettiCount; i++) {
        confettiParticles.push({
            x: Math.random() * canvas.width,
            y: -20,
            size: Math.random() * 8 + 4,
            speedY: Math.random() * 3 + 2,
            speedX: (Math.random() - 0.5) * 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
    
    function animateConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        confettiParticles.forEach((particle, index) => {
            particle.y += particle.speedY;
            particle.x += particle.speedX;
            particle.rotation += particle.rotationSpeed;
            
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate((particle.rotation * Math.PI) / 180);
            ctx.fillStyle = particle.color;
            ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            ctx.restore();
            
            if (particle.y > canvas.height) {
                confettiParticles.splice(index, 1);
            }
        });
        
        if (confettiParticles.length > 0) {
            requestAnimationFrame(animateConfetti);
        }
    }
    
    animateConfetti();
}

// MISE À JOUR DE LA PROGRESSION
function updateProgress() {
    const unlockedPercentage = (gameState.unlockedCases.length / 64) * 100;
    
    document.getElementById('currentPos').textContent = gameState.currentPosition;
    document.getElementById('unlockedCount').textContent = gameState.unlockedCases.length;
    document.getElementById('challengesCount').textContent = gameState.challengesCompleted;
    
    // Système de niveaux basé sur la progression
    let level = '';
    let levelEmoji = '';
    
    if (unlockedPercentage < 20) {
        level = 'Jeune pousse';
        levelEmoji = '🌱';
    } else if (unlockedPercentage < 40) {
        level = 'Explorateur';
        levelEmoji = '🧭';
    } else if (unlockedPercentage < 60) {
        level = 'Créateur';
        levelEmoji = '✨';
    } else if (unlockedPercentage < 80) {
        level = 'Influenceur';
        levelEmoji = '🚀';
    } else if (unlockedPercentage < 100) {
        level = 'Stratège';
        levelEmoji = '💎';
    } else {
        level = 'Légende';
        levelEmoji = '👑';
    }
    
    // Affichage des badges avec niveau
    let badgeText = '';
    if (unlockedPercentage >= 100) {
        badgeText = `${levelEmoji} ${level} | 🥇 Or - LÉGENDE !`;
    } else if (unlockedPercentage >= 60) {
        badgeText = `${levelEmoji} ${level} | 🥈 Argent`;
    } else if (unlockedPercentage >= 30) {
        badgeText = `${levelEmoji} ${level} | 🥉 Bronze`;
    } else {
        badgeText = `${levelEmoji} ${level} | 🔒 Débloque 30%`;
    }
    
    document.getElementById('badgeDisplay').textContent = badgeText;
    
    // Notification de changement de niveau
    if (!gameState.currentLevel) gameState.currentLevel = 'Jeune pousse';
    if (gameState.currentLevel !== level) {
        setTimeout(() => {
            playCelebrationSound();
            createConfetti();
            alert(`🎉 NIVEAU UP ! Tu es maintenant ${levelEmoji} ${level} ! Continue comme ça ! 💪`);
        }, 500);
        gameState.currentLevel = level;
        saveGameState();
    }
}

// CRÉATION DU PLATEAU
function createBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    
    for (let i = 0; i < 64; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        
        const isUnlocked = gameState.unlockedCases.includes(i);
        const isVisited = gameState.visitedCases.includes(i);
        const isActive = gameState.currentPosition === i;
        
        if (isActive) cell.classList.add('active');
        else if (isVisited) cell.classList.add('visited');
        else if (isUnlocked) cell.classList.add('unlocked');
        else cell.classList.add('locked');
        
        // Ajouter la classe de type spécial si applicable
        if (cases[i].type !== "normal" && cases[i].type !== "start") cell.classList.add(cases[i].type);
        
        // Ajouter la classe de thème (sauf pour les types spéciaux qui ont leur propre style)
        const specialTypes = ['challenge', 'mega-forward', 'bad-buzz', 'viral-post', 'algorithm-drop', 'partnership', 'trends', 'fast-forward', 'blocked'];
        if (cases[i].theme && !specialTypes.includes(cases[i].type)) {
            cell.classList.add('theme-' + cases[i].theme);
        }
        
        cell.innerHTML = `<div class="cell-number">${i}</div><div class="cell-title">${cases[i].title}</div>`;
        
        if (isUnlocked || isVisited) cell.onclick = () => showCase(i);
        
        board.appendChild(cell);
    }
    
    updateProgress();
}

// LANCER LE DÉ
function rollDice() {
    // Vérifier si on doit passer le tour (Algorithm Drop)
    if (gameState.skipNextTurn) {
        alert('📉 Tu dois passer ton tour à cause de l\'Algorithm Drop ! Analyse ta stratégie et prépare-toi pour le prochain lancement ! 💪');
        gameState.skipNextTurn = false;
        saveGameState();
        return;
    }
    
    const diceElement = document.getElementById('dice');
    const roll = Math.floor(Math.random() * 6) + 1;
    
    diceElement.textContent = roll;
    diceElement.style.transform = 'rotate(360deg) scale(1.2)';
    playSound(600, 0.1);
    
    setTimeout(() => {
        diceElement.textContent = '🎲';
        diceElement.style.transform = 'none';
        movePlayer(roll);
    }, 1000);
}

// DÉPLACER LE JOUEUR
function movePlayer(steps) {
    gameState.currentPosition = Math.min(63, gameState.currentPosition + steps);
    const newPosition = gameState.currentPosition;
    
    if (!gameState.unlockedCases.includes(newPosition)) {
        gameState.unlockedCases.push(newPosition);
        playUnlockSound();
    }
    
    saveGameState();
    createBoard();
    
    setTimeout(() => {
        showCase(newPosition);
        
        if (gameState.visitedCases.length > 0 && gameState.visitedCases.length % 5 === 0) {
            if (gameState.lastRewardAt !== gameState.visitedCases.length) {
                setTimeout(() => showUnlockReward(), 1000);
            }
        }
    }, 500);
}

// AFFICHER UNE RÉCOMPENSE DE DÉBLOCAGE
function showUnlockReward() {
    playRewardSound();
    createConfetti();
    
    const lockedCases = [];
    for (let i = 0; i < 64; i++) {
        if (!gameState.unlockedCases.includes(i) && !gameState.visitedCases.includes(i)) {
            lockedCases.push(i);
        }
    }
    
    if (lockedCases.length === 0) {
        alert('🎉 Bravo ! Tu as débloqué toutes les cases ! 🥇');
        return;
    }
    
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.innerHTML = '🎁 RÉCOMPENSE ! Débloque une case de ton choix !';
    
    let optionsHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin: 20px 0;">';
    lockedCases.forEach(index => {
        optionsHTML += `
            <div style="padding: 15px; border: 3px solid #e0e0e0; border-radius: 10px; cursor: pointer; transition: all 0.3s; text-align: center; background: white;" onmouseover="this.style.borderColor='#667eea'; this.style.transform='scale(1.05)';" onmouseout="this.style.borderColor='#e0e0e0'; this.style.transform='scale(1)';" onclick="selectUnlock(${index})">
                <div style="font-weight: bold; font-size: 1.4em; color: #667eea; margin-bottom: 5px;">${index}</div>
                <div style="font-size: 0.75em; color: #333;">${cases[index].title}</div>
            </div>
        `;
    });
    optionsHTML += '</div>';
    
    modalBody.innerHTML = `
        <p style="font-size: 1.2em; margin-bottom: 20px;">
            <strong>🎊 BRAVO !</strong><br>
            Tu as visité 5 cases ! En récompense, tu peux choisir une case verrouillée à débloquer !
        </p>
        ${optionsHTML}
        <p style="margin-top: 20px; color: #666; font-size: 0.9em;">
            Clique sur une case pour la débloquer et la découvrir immédiatement !
        </p>
    `;
    
    modal.classList.add('active');
}

// SÉLECTIONNER UNE CASE À DÉBLOQUER
function selectUnlock(index) {
    if (!gameState.unlockedCases.includes(index)) {
        gameState.unlockedCases.push(index);
        gameState.lastRewardAt = gameState.visitedCases.length;
        playSuccessSound();
        createConfetti();
        saveGameState();
        createBoard();
        closeModal();
        alert(`✨ Case ${index} débloquée ! Tu peux maintenant cliquer dessus pour la découvrir !`);
    }
}

// AFFICHER UNE CASE
function showCase(index) {
    if (!gameState.visitedCases.includes(index)) {
        gameState.visitedCases.push(index);
        saveGameState();
        createBoard();
    }
    
    if (index === 63) {
        setTimeout(() => {
            playCelebrationSound();
            setTimeout(() => playCelebrationSound(), 400);
            createConfetti();
            setTimeout(() => createConfetti(), 300);
            setTimeout(() => createConfetti(), 600);
            setTimeout(() => {
                alert('🎉🏆 FÉLICITATIONS ! TU AS TERMINÉ LE VOYAGE ! 🏆🎉\n\nTu es maintenant un·e expert·e en création de contenu ! 🌟💪\n\nTu es INCROYABLE !');
            }, 1000);
        }, 300);
    }
    
    const caseData = cases[index];
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    let badge = '';
    if (caseData.type === 'challenge') {
        badge = '<span class="badge badge-challenge">🎯 DÉFI</span>';
    } else if (caseData.type === 'fast-forward') {
        badge = '<span class="badge badge-fast">⚡ AVANCE RAPIDE</span>';
    } else if (caseData.type === 'blocked') {
        badge = '<span class="badge badge-blocked">🚫 PAUSE</span>';
    } else if (caseData.type === 'mega-forward') {
        badge = '<span class="badge badge-mega-forward">💥 BUZZ INATTENDU</span>';
    } else if (caseData.type === 'bad-buzz') {
        badge = '<span class="badge badge-bad-buzz">😰 BAD BUZZ</span>';
    } else if (caseData.type === 'viral-post') {
        badge = '<span class="badge badge-viral">🔥 POST VIRAL</span>';
    } else if (caseData.type === 'algorithm-drop') {
        badge = '<span class="badge badge-algorithm">📉 ALGORITHM DROP</span>';
    } else if (caseData.type === 'partnership') {
        badge = '<span class="badge badge-partnership">🎁 PARTENARIAT</span>';
    } else if (caseData.type === 'trends') {
        badge = '<span class="badge badge-trends">🔥 TENDANCES 2025</span>';
    }
    
    modalTitle.innerHTML = `<span class="emoji">🎨</span> Case ${index} : ${caseData.title}`;
    
    modalBody.innerHTML = `
        ${badge}
        <p><strong>${caseData.description}</strong></p>
        
        <div id="aiResponseSection" style="margin-top: 20px;">
            <div style="background: linear-gradient(135deg, #667eea15, #764ba215); border-left: 4px solid #667eea; padding: 15px; border-radius: 0 10px 10px 0; margin-bottom: 15px;">
                <p style="color: #667eea; font-weight: 600; margin-bottom: 5px;">💡 Ce que Tithot peut faire pour toi :</p>
                <p style="color: #555; font-size: 0.95em; margin: 0;">${caseData.cometMission}</p>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label for="userContentInput" style="display: block; font-weight: 600; color: #667eea; margin-bottom: 8px;">
                    ✍️ Ton contenu (optionnel) :
                </label>
                <textarea id="userContentInput" style="width: 100%; padding: 15px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 1em; font-family: inherit; resize: vertical; min-height: 120px; transition: border-color 0.3s;" placeholder="Si tu as déjà un texte, colle-le ici pour que Tithot l'améliore. Sinon, laisse vide et Tithot te guidera !"></textarea>
                <small style="color: #888; font-size: 0.85em;">💡 Tu peux aussi poser une question spécifique ou demander un exemple</small>
            </div>
            
            <div id="aiResponseContent" style="background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%); padding: 20px; border-radius: 10px; min-height: 100px; display: none; max-height: 400px; overflow-y: auto;">
                <div id="aiResponse" style="line-height: 1.8; white-space: pre-wrap;"></div>
            </div>
            
            <div id="aiLoading" style="display: none; text-align: center; padding: 20px;">
                <div style="width: 150px; height: 150px; margin: 0 auto; position: relative;">
                    <dotlottie-wc src="https://lottie.host/31e18ce0-6f4b-474c-8b3e-046e415ea9bb/O5jEMojyhf.lottie" style="position: absolute; top: 0; left: 0; width: 150px; height: 150px;" autoplay loop></dotlottie-wc>
                </div>
                <div style="font-size: 1.2em; color: #667eea; margin-top: 10px;">
                    ✨ Tithot réfléchit...
                </div>
            </div>
            
            <button class="btn btn-primary" onclick="askAI('${caseData.cometMission.replace(/'/g, "\\'")}', ${index})" style="margin-top: 15px; width: 100%;">
                🚀 Demander à Tithot
            </button>
        </div>
        
        <div id="followUpSection" style="display: none; margin-top: 20px;">
            <p style="color: #667eea; font-weight: bold;">💬 Vous souhaitez des précisions sur un des aspects abordés ?</p>
            <p style="color: #999; font-size: 0.9em; margin-bottom: 10px;">
                Vous pouvez encore poser <span id="questionsCount">2</span> question(s)
            </p>
            <textarea id="followUpQuestion" style="width: 100%; padding: 15px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 1em; font-family: inherit; resize: vertical; min-height: 80px;" placeholder="Posez votre question ici..."></textarea>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button class="btn btn-primary" onclick="askFollowUp()" style="flex: 1;">
                    📤 Envoyer
                </button>
                <button class="btn btn-secondary" onclick="exportConversation('txt')" style="flex: 1;">
                    📄 Exporter TXT
                </button>
                <button class="btn btn-secondary" onclick="exportConversation('md')" style="flex: 1;">
                    📝 Exporter MD
                </button>
            </div>
        </div>
        
        ${caseData.type === 'challenge' ? `
            <div style="background: linear-gradient(135deg, #fa709a, #fee140); color: white; padding: 20px; border-radius: 10px; margin-top: 20px;">
                <strong>🎯 Pour réussir ce défi :</strong><br>
                Fais l'exercice demandé et utilise Tithot pour t'aider si besoin !<br>
                <button class="btn btn-secondary" onclick="completeChallenge()" style="margin-top: 15px;">✅ J'ai terminé ce défi !</button>
            </div>
        ` : ''}
        ${caseData.type === 'fast-forward' ? `
            <div style="background: linear-gradient(135deg, #84fab0, #8fd3f4); color: white; padding: 20px; border-radius: 10px; margin-top: 20px;">
                <strong>⚡ SUPER !</strong><br>
                Le jeu va t'avancer automatiquement de 2 cases bonus dans quelques secondes !
            </div>
        ` : ''}
        ${caseData.type === 'mega-forward' ? `
            <div style="background: linear-gradient(135deg, #f093fb, #f5576c); color: white; padding: 20px; border-radius: 10px; margin-top: 20px;">
                <strong>💥 INCROYABLE !</strong><br>
                Ton buzz fait exploser ta visibilité ! Le jeu va t'avancer de 5 cases bonus dans quelques secondes !
            </div>
        ` : ''}
        ${caseData.type === 'bad-buzz' ? `
            <div style="background: linear-gradient(135deg, #fc4a1a, #f7b733); color: white; padding: 20px; border-radius: 10px; margin-top: 20px;">
                <strong>😰 BAD BUZZ !</strong><br>
                Cette situation délicate te fait reculer de 3 cases. Prends le temps d'apprendre de cette expérience !
            </div>
        ` : ''}
        ${caseData.type === 'viral-post' ? `
            <div style="background: linear-gradient(135deg, #4facfe, #00f2fe); color: white; padding: 20px; border-radius: 10px; margin-top: 20px;">
                <strong>🔥 POST VIRAL !</strong><br>
                Ton contenu cartonne ! Tu peux relancer le dé immédiatement pour continuer sur ta lancée !
            </div>
        ` : ''}
        ${caseData.type === 'algorithm-drop' ? `
            <div style="background: linear-gradient(135deg, #434343, #000000); color: white; padding: 20px; border-radius: 10px; margin-top: 20px;">
                <strong>📉 ALGORITHM DROP</strong><br>
                L'algorithme te pénalise temporairement. Tu dois passer ton prochain tour pour analyser et ajuster ta stratégie.
            </div>
        ` : ''}
        ${caseData.type === 'partnership' ? `
            <div style="background: linear-gradient(135deg, #FFD700, #FFA500); color: white; padding: 20px; border-radius: 10px; margin-top: 20px;">
                <strong>🎁 PARTENARIAT SURPRISE !</strong><br>
                Cette collaboration te donne un accès privilégié ! Tu vas pouvoir choisir ta prochaine case parmi les 10 prochaines !
            </div>
        ` : ''}
        ${caseData.type === 'trends' ? `
            <div style="background: linear-gradient(135deg, #a8edea, #fed6e3); color: #667eea; padding: 20px; border-radius: 10px; margin-top: 20px; border: 2px solid #667eea;">
                <strong>🔥 CASE SPÉCIALE : TENDANCES 2025</strong><br>
                Tu découvres les stratégies les plus actuelles pour dominer les réseaux sociaux cette année !
            </div>
        ` : ''}
        ${caseData.type === 'blocked' ? `
            <div style="background: linear-gradient(135deg, #fbc2eb, #a6c1ee); color: white; padding: 20px; border-radius: 10px; margin-top: 20px;">
                <strong>🚫 PAUSE</strong><br>
                Le jeu va automatiquement te faire prendre une pause ou reculer dans quelques secondes. C'est important de respirer !
            </div>
        ` : ''}
    `;
    
    modal.classList.add('active');
    
    // MOUVEMENT AUTOMATIQUE POUR LES CASES SPÉCIALES
    setTimeout(() => {
        const currentCase = cases[index];
        
        // MEGA FORWARD - Saute 5 cases
        if (currentCase.type === 'mega-forward') {
            setTimeout(() => {
                gameState.currentPosition = Math.min(gameState.currentPosition + 5, 63);
                
                if (!gameState.unlockedCases.includes(gameState.currentPosition)) {
                    gameState.unlockedCases.push(gameState.currentPosition);
                }
                
                playSuccessSound();
                createConfetti();
                saveGameState();
                createBoard();
                
                alert('💥 BUZZ INATTENDU ! Tu avances de 5 cases ! 🚀');
            }, 2000);
        }
        
        // AVANCES RAPIDES - 2 cases
        if (currentCase.type === 'fast-forward') {
            setTimeout(() => {
                let bonus = 2;
                
                if (currentCase.description.includes('avance de 3') || currentCase.description.includes('Avance de 3')) {
                    bonus = 3;
                } else if (currentCase.description.includes('avance d\'une') || currentCase.description.includes('Avance d\'une') || currentCase.description.includes('avance de 1')) {
                    bonus = 1;
                }
                
                gameState.currentPosition = Math.min(gameState.currentPosition + bonus, 63);
                
                if (!gameState.unlockedCases.includes(gameState.currentPosition)) {
                    gameState.unlockedCases.push(gameState.currentPosition);
                }
                
                playSuccessSound();
                createConfetti();
                saveGameState();
                createBoard();
                
                alert(`⚡ Tu avances automatiquement de ${bonus} case${bonus > 1 ? 's' : ''} bonus !`);
            }, 2000);
        }
        
        // BAD BUZZ - Recule 3 cases
        if (currentCase.type === 'bad-buzz') {
            setTimeout(() => {
                gameState.currentPosition = Math.max(gameState.currentPosition - 3, 0);
                alert('😰 Bad buzz ! Tu recules de 3 cases. Apprends de cette expérience !');
                saveGameState();
                createBoard();
            }, 2000);
        }
        
        // VIRAL POST - Rejoue ton tour (le dé se relance automatiquement)
        if (currentCase.type === 'viral-post') {
            setTimeout(() => {
                playCelebrationSound();
                createConfetti();
                alert('🔥 POST VIRAL ! Tu peux relancer le dé immédiatement !');
                closeModal();
            }, 2000);
        }
        
        // ALGORITHM DROP - Passe ton tour (marque dans le state)
        if (currentCase.type === 'algorithm-drop') {
            setTimeout(() => {
                gameState.skipNextTurn = true;
                alert('📉 Algorithm Drop ! Tu vas devoir passer ton prochain tour pour analyser ta stratégie.');
                saveGameState();
            }, 2000);
        }
        
        // PARTNERSHIP - Choisis ta case parmi les 10 prochaines
        if (currentCase.type === 'partnership') {
            setTimeout(() => {
                showPartnershipChoice();
            }, 2000);
        }
        
        // BLOCAGES
        if (currentCase.type === 'blocked') {
            setTimeout(() => {
                if (currentCase.description.includes('Recule d\'une case') || currentCase.description.includes('recule d\'une case') || currentCase.description.includes('recule de 1')) {
                    gameState.currentPosition = Math.max(gameState.currentPosition - 1, 0);
                    alert('🚫 Tu recules d\'une case pour réfléchir.');
                } else if (currentCase.description.includes('recule de 2') || currentCase.description.includes('Recule de 2')) {
                    gameState.currentPosition = Math.max(gameState.currentPosition - 2, 0);
                    alert('🚫 Tu recules de 2 cases. Prends le temps de respirer.');
                } else {
                    alert('🚫 Tu restes sur cette case ce tour. Prends une pause !');
                }
                
                saveGameState();
                createBoard();
            }, 2000);
        }
    }, 500);
}

// FERMER LA MODALE
function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

// CHOIX DE PARTENARIAT - Choisir parmi les 10 prochaines cases
function showPartnershipChoice() {
    playCelebrationSound();
    createConfetti();
    closeModal();
    
    const currentPos = gameState.currentPosition;
    const maxPos = Math.min(currentPos + 10, 63);
    const availableCases = [];
    
    for (let i = currentPos + 1; i <= maxPos; i++) {
        availableCases.push(i);
    }
    
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.innerHTML = '🎁 PARTENARIAT ! Choisis ta case !';
    
    let optionsHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin: 20px 0;">';
    availableCases.forEach(index => {
        optionsHTML += `
            <div style="padding: 15px; border: 3px solid #FFD700; border-radius: 10px; cursor: pointer; transition: all 0.3s; text-align: center; background: linear-gradient(135deg, #fff9e6, #ffe6b3);" onmouseover="this.style.transform='scale(1.05)'; this.style.borderColor='#FFA500';" onmouseout="this.style.transform='scale(1)'; this.style.borderColor='#FFD700';" onclick="selectPartnershipCase(${index})">
                <div style="font-weight: bold; font-size: 1.5em; color: #FFA500; margin-bottom: 5px;">${index}</div>
                <div style="font-size: 0.7em; color: #666;">${cases[index].title}</div>
            </div>
        `;
    });
    optionsHTML += '</div>';
    
    modalBody.innerHTML = `
        <p style="font-size: 1.2em; margin-bottom: 20px;">
            <strong>🎊 OPPORTUNITÉ UNIQUE !</strong><br>
            Ce partenariat te permet de sauter directement à une case de ton choix parmi les 10 prochaines !
        </p>
        ${optionsHTML}
        <p style="margin-top: 20px; color: #666; font-size: 0.9em;">
            Clique sur la case où tu veux aller immédiatement !
        </p>
    `;
    
    modal.classList.add('active');
}

// SÉLECTIONNER UNE CASE POUR LE PARTENARIAT
function selectPartnershipCase(index) {
    gameState.currentPosition = index;
    
    if (!gameState.unlockedCases.includes(index)) {
        gameState.unlockedCases.push(index);
    }
    
    playSuccessSound();
    createConfetti();
    saveGameState();
    createBoard();
    closeModal();
    
    setTimeout(() => {
        showCase(index);
    }, 500);
}

// INTERACTION AVEC L'IA
async function askAI(question, caseIndex) {
    // Récupérer le contenu utilisateur
    const userContentInput = document.getElementById('userContentInput');
    const userContent = userContentInput ? userContentInput.value.trim() : '';
    
    // Récupérer le profil utilisateur
    const userProfile = window.UserProfile ? window.UserProfile.get() : null;
    
    // Construire la question complète avec contexte du profil
    let fullQuestion = question;
    if (userContent) {
        fullQuestion = `${question}\n\nVoici le contenu de l'utilisateur à analyser/améliorer :\n\n"${userContent}"`;
    }
    
    // Reset conversation if new case
    if (currentConversation.currentCaseIndex !== caseIndex) {
        currentConversation = {
            messages: [],
            questionsRemaining: 2,
            currentCaseIndex: caseIndex
        };
    }
    
    const loadingDiv = document.getElementById('aiLoading');
    const responseDiv = document.getElementById('aiResponseContent');
    const responseText = document.getElementById('aiResponse');
    const followUpSection = document.getElementById('followUpSection');
    
    // Show loading
    loadingDiv.style.display = 'block';
    responseDiv.style.display = 'none';
    
    // Hide the ask button
    event.target.style.display = 'none';
    
    // Disable textarea during loading
    if (userContentInput) {
        userContentInput.disabled = true;
        userContentInput.style.opacity = '0.6';
    }
    
    try {
        // Add user question to conversation
        currentConversation.messages.push({
            role: "user",
            content: fullQuestion
        });
        
        // Préparer la requête
        let url, headers, body;
        
        if (API_CONFIG.useWorker && API_CONFIG.workerUrl) {
            // Utiliser le Cloudflare Worker avec le profil
            url = API_CONFIG.workerUrl;
            headers = {
                "Content-Type": "application/json",
            };
            body = JSON.stringify({
                messages: currentConversation.messages,
                userProfile: userProfile // Envoyer le profil au worker
            });
        } else {
            // Utiliser l'API directe
            if (!API_CONFIG.apiKey || API_CONFIG.apiKey === "VOTRE_CLE_API_ICI") {
                throw new Error("Clé API non configurée. Modifie API_CONFIG.apiKey dans game-logic.js");
            }
            
            url = "https://api.anthropic.com/v1/messages";
            headers = {
                "Content-Type": "application/json",
                "x-api-key": API_CONFIG.apiKey,
                "anthropic-version": "2023-06-01"
            };
            body = JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 2000,
                messages: currentConversation.messages
            });
        }
        
        // Call API
        const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: body
        });
        
        if (!response.ok) {
            throw new Error(`Erreur API: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponseText = data.content[0].text;
        
        // Add AI response to conversation
        currentConversation.messages.push({
            role: "assistant",
            content: aiResponseText
        });
        
        // Hide loading, show response
        loadingDiv.style.display = 'none';
        responseDiv.style.display = 'block';
        
        // Simulate typing effect
        await typeWriter(responseText, aiResponseText, 20);
        
        // Show follow-up section if questions remaining
        if (currentConversation.questionsRemaining > 0) {
            followUpSection.style.display = 'block';
            document.getElementById('questionsCount').textContent = currentConversation.questionsRemaining;
        }
        
        playSuccessSound();
        
        // Réactiver le textarea
        const userContentInput = document.getElementById('userContentInput');
        if (userContentInput) {
            userContentInput.disabled = false;
            userContentInput.style.opacity = '1';
        }
        
    } catch (error) {
        console.error('Erreur AI:', error);
        loadingDiv.style.display = 'none';
        responseDiv.style.display = 'block';
        responseText.innerHTML = `
            <div style="color: #ff6b6b; padding: 20px; text-align: center;">
                ❌ Oups ! Une erreur s'est produite.<br>
                <span style="font-size: 0.9em;">Vérifie ta connexion et réessaie.</span>
            </div>
        `;
        
        // Réactiver le textarea même en cas d'erreur
        const userContentInput = document.getElementById('userContentInput');
        if (userContentInput) {
            userContentInput.disabled = false;
            userContentInput.style.opacity = '1';
        }
    }
}

// TYPING EFFECT
async function typeWriter(element, text, speed) {
    element.textContent = '';
    let i = 0;
    
    // Trouver le conteneur scrollable parent
    const scrollContainer = document.getElementById('aiResponseContent');
    
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                // Auto-scroll du conteneur parent
                if (scrollContainer) {
                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                }
            } else {
                clearInterval(interval);
                // Format the text nicely after typing
                element.innerHTML = formatAIResponse(text);
                // Scroll final
                if (scrollContainer) {
                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                }
                resolve();
            }
        }, speed);
    });
}

// FORMAT AI RESPONSE
function formatAIResponse(text) {
    // Convert markdown-style formatting to HTML
    let formatted = text
        // Titres - du plus spécifique au plus général
        .replace(/^#### (.+)$/gm, '<h5 style="color: #667eea; font-size: 1em; margin: 15px 0 8px 0; font-weight: 600;">$1</h5>')
        .replace(/^### (.+)$/gm, '<h4 style="color: #667eea; font-size: 1.1em; margin: 18px 0 10px 0; font-weight: 600;">$1</h4>')
        .replace(/^## (.+)$/gm, '<h3 style="color: #764ba2; font-size: 1.3em; margin: 20px 0 12px 0; font-weight: 700;">$1</h3>')
        .replace(/^# (.+)$/gm, '<h2 style="background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 1.5em; margin: 25px 0 15px 0; font-weight: 800;">$1</h2>')
        // Listes à puces
        .replace(/^- (.+)$/gm, '<li style="margin: 5px 0; padding-left: 5px;">$1</li>')
        .replace(/(<li.*<\/li>\n?)+/g, '<ul style="margin: 10px 0; padding-left: 20px;">$&</ul>')
        // Gras et italique
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #4a5568;">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Paragraphes et sauts de ligne
        .replace(/\n\n/g, '</p><p style="margin: 12px 0;">')
        .replace(/\n/g, '<br>');
    
    return '<p style="margin: 12px 0;">' + formatted + '</p>';
}

// FOLLOW-UP QUESTION
async function askFollowUp() {
    const questionInput = document.getElementById('followUpQuestion');
    const question = questionInput.value.trim();
    
    if (!question) {
        alert('⚠️ Veuillez saisir une question !');
        return;
    }
    
    if (currentConversation.questionsRemaining <= 0) {
        alert('❌ Vous avez atteint le nombre maximum de questions pour cette case !');
        return;
    }
    
    // Récupérer le profil utilisateur
    const userProfile = window.UserProfile ? window.UserProfile.get() : null;
    
    // Decrease questions count
    currentConversation.questionsRemaining--;
    
    // Clear input
    questionInput.value = '';
    
    // Add user question to display
    const responseDiv = document.getElementById('aiResponse');
    const responseContainer = document.getElementById('aiResponseContent');
    
    responseDiv.innerHTML += `
        <div style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 10px;">
            <strong>Vous :</strong><br>
            ${question}
        </div>
        <div id="inlineLoading" style="text-align: center; padding: 20px;">
            <div style="width: 100px; height: 100px; margin: 0 auto; position: relative;">
                <dotlottie-wc src="https://lottie.host/31e18ce0-6f4b-474c-8b3e-046e415ea9bb/O5jEMojyhf.lottie" style="position: absolute; top: 0; left: 0; width: 100px; height: 100px;" autoplay loop></dotlottie-wc>
            </div>
            <div style="font-size: 1em; color: #667eea; margin-top: 10px;">✨ Tithot réfléchit...</div>
        </div>
    `;
    
    // Scroll to bottom
    responseContainer.scrollTop = responseContainer.scrollHeight;
    
    try {
        // Add to conversation
        currentConversation.messages.push({
            role: "user",
            content: question
        });
        
        // Préparer la requête
        let url, headers, body;
        
        if (API_CONFIG.useWorker && API_CONFIG.workerUrl) {
            // Utiliser le Cloudflare Worker avec le profil
            url = API_CONFIG.workerUrl;
            headers = {
                "Content-Type": "application/json",
            };
            body = JSON.stringify({
                messages: currentConversation.messages,
                userProfile: userProfile // Envoyer le profil au worker
            });
        } else {
            // Utiliser l'API directe
            if (!API_CONFIG.apiKey || API_CONFIG.apiKey === "VOTRE_CLE_API_ICI") {
                throw new Error("Clé API non configurée. Modifie API_CONFIG.apiKey dans game-logic.js");
            }
            
            url = "https://api.anthropic.com/v1/messages";
            headers = {
                "Content-Type": "application/json",
                "x-api-key": API_CONFIG.apiKey,
                "anthropic-version": "2023-06-01"
            };
            body = JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 2000,
                messages: currentConversation.messages
            });
        }
        
        // Call API
        const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: body
        });
        
        if (!response.ok) {
            throw new Error(`Erreur API: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponseText = data.content[0].text;
        
        // Add to conversation
        currentConversation.messages.push({
            role: "assistant",
            content: aiResponseText
        });
        
        // Remove inline loading
        const inlineLoading = document.getElementById('inlineLoading');
        if (inlineLoading) {
            inlineLoading.remove();
        }
        
        // Add AI response
        responseDiv.innerHTML += `
            <div style="margin-top: 15px; padding: 15px; background: white; border: 2px solid #667eea; border-radius: 10px; color: #333;">
                <strong style="color: #667eea;">Tithot :</strong><br>
                <span id="followUpResponse"></span>
            </div>
        `;
        
        // Typing effect for follow-up
        const followUpElement = document.getElementById('followUpResponse');
        await typeWriter(followUpElement, aiResponseText, 15);
        
        // Scroll to bottom after response
        responseContainer.scrollTop = responseContainer.scrollHeight;
        
        // Update questions count
        document.getElementById('questionsCount').textContent = currentConversation.questionsRemaining;
        
        // Hide follow-up section if no questions left
        if (currentConversation.questionsRemaining <= 0) {
            questionInput.disabled = true;
            questionInput.placeholder = "Limite de questions atteinte pour cette case";
            document.querySelector('#followUpSection .btn-primary').disabled = true;
        }
        
        playSuccessSound();
        
    } catch (error) {
        console.error('Erreur follow-up:', error);
        
        // Remove inline loading
        const inlineLoading = document.getElementById('inlineLoading');
        if (inlineLoading) {
            inlineLoading.remove();
        }
        
        responseDiv.innerHTML += `
            <div style="margin-top: 15px; padding: 15px; background: #ffe6e6; border-radius: 10px; color: #ff6b6b;">
                ❌ Erreur lors de l'envoi de la question. Réessayez.
            </div>
        `;
    }
}

// EXPORT CONVERSATION
function exportConversation(format) {
    if (currentConversation.messages.length === 0) {
        alert('⚠️ Aucune conversation à exporter !');
        return;
    }
    
    let content = '';
    const caseData = cases[currentConversation.currentCaseIndex];
    const timestamp = new Date().toLocaleString('fr-FR');
    
    if (format === 'txt') {
        content = `========================================
CONVERSATION - ${caseData.title}
Date: ${timestamp}
========================================

`;
        
        currentConversation.messages.forEach((msg, index) => {
            const role = msg.role === 'user' ? 'VOUS' : 'TITHOT';
            content += `${role}:\n${msg.content}\n\n`;
            if (index < currentConversation.messages.length - 1) {
                content += '----------------------------------------\n\n';
            }
        });
        
    } else if (format === 'md') {
        content = `# 💬 Conversation - ${caseData.title}

**Date:** ${timestamp}  
**Case:** ${currentConversation.currentCaseIndex}

---

`;
        
        currentConversation.messages.forEach((msg) => {
            const role = msg.role === 'user' ? '👤 **Vous**' : '🤖 **Tithot**';
            content += `${role}:\n\n${msg.content}\n\n---\n\n`;
        });
    }
    
    // Create download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-case-${currentConversation.currentCaseIndex}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    playSuccessSound();
    alert(`✅ Conversation exportée en ${format.toUpperCase()} !`);
}

// FERMER LA MODALE (keeping original)
function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

// COMPLÉTER UN DÉFI
function completeChallenge() {
    gameState.challengesCompleted++;
    playSuccessSound();
    createConfetti();
    saveGameState();
    updateProgress();
    alert('🎉 Bravo ! Défi validé ! Tu gagnes un badge 🏆');
    closeModal();
}

// RECOMMENCER LE JEU
function restartGame() {
    if (confirm('🔄 Recommencer la partie ? (Ta progression sera conservée, seul le pion retournera à la case 0)')) {
        gameState.currentPosition = 0;
        saveGameState();
        document.querySelectorAll('.cell').forEach(c => c.classList.remove('active'));
        createBoard();
        playSound(440, 0.2);
    }
}

// NOUVELLE PARTIE
function newGame() {
    if (confirm('🆕 Nouvelle partie ? ⚠️ ATTENTION : Cela va EFFACER toute ta progression (cases débloquées, défis, badges). Es-tu sûr·e ?')) {
        gameState = {
            currentPosition: 0,
            unlockedCases: [0],
            visitedCases: [],
            challengesCompleted: 0,
            lastRewardAt: 0
        };
        saveGameState();
        document.querySelectorAll('.cell').forEach(c => c.classList.remove('active'));
        createBoard();
        playSound(440, 0.2);
        alert('🎮 Nouvelle partie lancée ! Bon courage ! 🌟');
    }
}

// AFFICHER LES INSTRUCTIONS
function showInstructions() {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.innerHTML = '📖 Comment jouer ?';
    modalBody.innerHTML = `
        <h3>🎯 But du jeu</h3>
        <p>Parcourir les 64 cases pour devenir expert·e en création de contenu sur les réseaux sociaux !</p>
        
        <h3>🎲 Règles du jeu</h3>
        <ol>
            <li>Lance le dé pour avancer sur le plateau</li>
            <li>Les cases se débloquent quand tu tombes dessus 🔓</li>
            <li>Lis la description de chaque case que tu visites</li>
            <li>Clique sur "Demander à Tithot" pour en savoir plus</li>
            <li><strong>RÉCOMPENSE :</strong> Toutes les 5 cases visitées, tu peux débloquer 1 case de ton choix ! 🎁</li>
            <li>Fais les défis pratiques pour gagner des badges 🏆</li>
        </ol>
        
        <h3>📊 Système de niveaux</h3>
        <p>🌱 <strong>Jeune pousse</strong> (0-19%)</p>
        <p>🧭 <strong>Explorateur</strong> (20-39%)</p>
        <p>✨ <strong>Créateur</strong> (40-59%)</p>
        <p>🚀 <strong>Influenceur</strong> (60-79%)</p>
        <p>💎 <strong>Stratège</strong> (80-99%)</p>
        <p>👑 <strong>Légende</strong> (100%)</p>
        
        <h3>🔒 Système de déblocage</h3>
        <p><strong>🔒 Verrouillée</strong> : Tu ne peux pas encore y accéder</p>
        <p><strong>✅ Débloquée</strong> : Tu peux cliquer et découvrir</p>
        <p><strong>⭐ Visitée</strong> : Tu as déjà lu cette case</p>
        
        <h3>🏷️ Types de cases</h3>
        <p><span class="badge badge-challenge">🎯 DÉFI</span> Des exercices pratiques à faire</p>
        <p><span class="badge badge-fast">⚡ AVANCE RAPIDE</span> Avance de 2 cases bonus</p>
        <p><span class="badge badge-mega-forward">💥 BUZZ INATTENDU</span> Saute 5 cases en avant !</p>
        <p><span class="badge badge-viral">🔥 POST VIRAL</span> Rejoue ton tour immédiatement</p>
        <p><span class="badge badge-partnership">🎁 PARTENARIAT</span> Choisis ta case parmi les 10 prochaines</p>
        <p><span class="badge badge-bad-buzz">😰 BAD BUZZ</span> Recule de 3 cases</p>
        <p><span class="badge badge-algorithm">📉 ALGORITHM DROP</span> Passe ton prochain tour</p>
        <p><span class="badge badge-blocked">🚫 PAUSE</span> Prends une pause</p>
        <p><span class="badge badge-trends">🔥 TENDANCES 2025</span> Découvre les dernières stratégies</p>
        
        <h3>🏆 Badges à gagner</h3>
        <p>🥉 <strong>Bronze</strong> : Débloque 30% des cases</p>
        <p>🥈 <strong>Argent</strong> : Débloque 60% des cases</p>
        <p>🥇 <strong>Or</strong> : Débloque 100% des cases (64/64)</p>
        
        <h3>🎮 Deux façons de jouer</h3>
        <p><strong>🔄 Recommencer :</strong> Le pion retourne à 0 mais tu gardes ta progression</p>
        <p><strong>🆕 Nouvelle partie :</strong> Tout est remis à zéro (cases, défis, badges)</p>
        
        <h3>🎯 Structure du parcours</h3>
        <p><strong>Cases 1-10 :</strong> Bases du storytelling<br>
        <strong>Cases 11-20 :</strong> Création visuelle et formats<br>
        <strong>Cases 21-30 :</strong> Engagement et algorithmes<br>
        <strong>Cases 31-40 :</strong> Outils avancés<br>
        <strong>Cases 41-50 :</strong> Créativité émotionnelle<br>
        <strong>Cases 51-60 :</strong> Croissance et monétisation<br>
        <strong>Cases 61-64 :</strong> Conclusion et défi final</p>
        
        <h3>🎨 Thématiques par couleur</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 10px 0;">
            <p style="background: linear-gradient(135deg, #e8d5f2, #d4b8e8); padding: 8px; border-radius: 8px; border-left: 4px solid #9b59b6; margin: 0;">🟣 <strong>Storytelling</strong></p>
            <p style="background: linear-gradient(135deg, #d6eaf8, #aed6f1); padding: 8px; border-radius: 8px; border-left: 4px solid #3498db; margin: 0;">🔵 <strong>Création visuelle</strong></p>
            <p style="background: linear-gradient(135deg, #d5f4e6, #a9dfbf); padding: 8px; border-radius: 8px; border-left: 4px solid #27ae60; margin: 0;">🟢 <strong>Vidéo & Formats</strong></p>
            <p style="background: linear-gradient(135deg, #fef9e7, #f9e79f); padding: 8px; border-radius: 8px; border-left: 4px solid #f1c40f; margin: 0;">🟡 <strong>Engagement</strong></p>
            <p style="background: linear-gradient(135deg, #fdebd0, #f5cba7); padding: 8px; border-radius: 8px; border-left: 4px solid #e67e22; margin: 0;">🟠 <strong>Outils</strong></p>
            <p style="background: linear-gradient(135deg, #fadbd8, #f5b7b1); padding: 8px; border-radius: 8px; border-left: 4px solid #e74c3c; margin: 0;">🔴 <strong>Croissance</strong></p>
            <p style="background: linear-gradient(135deg, #fdedec, #f5b7b1); padding: 8px; border-radius: 8px; border-left: 4px solid #ec7063; margin: 0;">🩷 <strong>Émotions</strong></p>
            <p style="background: linear-gradient(135deg, #fdfbfb, #ebedee); padding: 8px; border-radius: 8px; border-left: 4px solid #667eea; margin: 0;">⬜ <strong>Spéciales</strong></p>
        </div>
        
        <p style="margin-top: 20px; font-size: 1.2em; text-align: center;"><strong>Tu es prêt·e à devenir un·e pro des réseaux sociaux ? 🚀</strong></p>
    `;
    
    modal.classList.add('active');
}

// GESTION DES CLICS EN DEHORS DE LA MODALE
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
}

// INITIALISATION AU CHARGEMENT DE LA PAGE
window.onload = function() {
    loadGameState();
    createBoard();
    showInstructions();
};
