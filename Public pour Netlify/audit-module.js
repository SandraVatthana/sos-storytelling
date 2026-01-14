/**
 * MODULE D'AUDIT RESEAUX SOCIAUX - SOS STORYTELLING
 * Adapté de GEO for Creators
 *
 * Analyse les profils et posts RS pour optimiser la visibilité
 */

const AuditModule = (function() {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================

    const PLATFORMS = {
        linkedin: { name: 'LinkedIn', emoji: '💼', weight: 1.5, hint: 'Fais une capture d\'écran montrant ta photo, bannière et bio' },
        instagram: { name: 'Instagram', emoji: '📸', weight: 1.0, hint: 'Fais une capture d\'écran montrant ta photo, bio et grille de posts' },
        tiktok: { name: 'TikTok', emoji: '🎵', weight: 0.8, hint: 'Fais une capture d\'écran montrant ta photo, bio et miniatures vidéos' },
        twitter: { name: 'X/Twitter', emoji: '🐦', weight: 1.0, hint: 'Fais une capture d\'écran montrant ta photo, bannière et bio' }
    };

    const EXPERTISE_KEYWORDS = [
        'expert', 'experte', 'spécialiste', 'consultant', 'consultante',
        'coach', 'formateur', 'formatrice', 'fondateur', 'fondatrice',
        'ceo', 'directeur', 'directrice', 'créateur', 'créatrice',
        'accompagne', 'aide', 'j\'aide', 'je forme'
    ];

    const CITABLE_PATTERNS = [
        'conseil', 'astuce', 'erreur', 'étape', 'secret', 'méthode',
        'comment', 'pourquoi', 'guide', 'tutoriel', 'framework',
        '3 façons', '5 étapes', '7 erreurs', 'voici comment'
    ];

    // Patterns d'accroches
    const HOOK_PATTERNS = {
        curiosity: {
            name: 'Curiosité',
            emoji: '🔍',
            score: 90,
            patterns: [
                /^(j'ai découvert|j'ai compris|j'ai réalisé)/i,
                /^(personne ne parle de|on ne vous dit pas)/i,
                /^(le secret|la vérité sur)/i,
                /^(voici pourquoi|voici comment)/i
            ]
        },
        story: {
            name: 'Storytelling',
            emoji: '📖',
            score: 85,
            patterns: [
                /^(il y a \d+|l'année dernière|hier|ce matin)/i,
                /^(j'ai fait une erreur|j'ai échoué)/i,
                /^(quand j'ai commencé|à mes débuts)/i,
                /^(un client m'a dit|une cliente m'a demandé)/i
            ]
        },
        question: {
            name: 'Question',
            emoji: '❓',
            score: 80,
            patterns: [
                /^(tu te demandes|vous vous demandez)/i,
                /^(pourquoi|comment|et si|savais-tu)/i,
                /\?$/
            ]
        },
        provocation: {
            name: 'Provocation',
            emoji: '💥',
            score: 85,
            patterns: [
                /^(arrête de|arrêtez de|stop)/i,
                /^(non,|faux|mythe)/i,
                /^(tout le monde se trompe)/i
            ]
        },
        list: {
            name: 'Liste/Chiffres',
            emoji: '📋',
            score: 75,
            patterns: [
                /^(\d+) (erreurs|conseils|astuces|étapes|façons)/i,
                /^(les|mes) \d+ /i
            ]
        },
        flatStatement: {
            name: 'Affirmation plate',
            emoji: '😐',
            score: 30,
            patterns: [
                /^(aujourd'hui|cette semaine)/i,
                /^(je voulais|je souhaitais)/i,
                /^(bonjour|hello|coucou)/i
            ]
        }
    };

    // Patterns CTA
    const CTA_PATTERNS = {
        strong: {
            score: 100,
            patterns: [
                /commente/i, /écris.moi/i, /réserve/i,
                /clique/i, /télécharge/i, /inscris.toi/i,
                /rejoins/i, /lien en bio/i, /dm.moi/i
            ]
        },
        medium: {
            score: 60,
            patterns: [
                /qu'en penses?.tu/i, /et toi/i,
                /dis.moi en commentaire/i, /partage ton/i
            ]
        },
        weak: {
            score: 30,
            patterns: [/\?$/, /like si/i, /tag/i]
        }
    };

    // ============================================================
    // AUDIT PROFILS
    // ============================================================

    function auditLinkedIn(profile, userKeywords) {
        const scores = { headline: 0, bio: 0, keywords: 0 };
        const issues = [];
        const recommendations = [];

        const headline = (profile.headline || '').toLowerCase();
        const bio = (profile.summary || '').toLowerCase();

        // Headline (35 pts)
        if (!headline) {
            issues.push({ severity: 'high', message: 'Pas de titre LinkedIn' });
            recommendations.push('Ajoute un titre : "[Métier] | J\'aide [cible] à [résultat]"');
        } else {
            const hasExpertise = EXPERTISE_KEYWORDS.some(k => headline.includes(k));
            const hasTarget = headline.includes('aide') || headline.includes('pour');
            scores.headline = hasExpertise && hasTarget ? 35 : (hasExpertise || hasTarget ? 25 : 15);
            if (scores.headline < 35) {
                recommendations.push('Reformule ton titre avec ton expertise ET ta cible');
            }
        }

        // Bio (35 pts)
        if (!bio || bio.length < 50) {
            issues.push({ severity: 'high', message: 'Section "À propos" trop courte ou absente' });
            recommendations.push('Développe ton "À propos" (200-500 mots)');
        } else {
            const hasExpertise = EXPERTISE_KEYWORDS.some(k => bio.includes(k));
            const hasCTA = bio.includes('contact') || bio.includes('@') || bio.includes('rdv');
            scores.bio = hasExpertise && hasCTA ? 35 : (hasExpertise ? 25 : 15);
        }

        // Keywords (30 pts)
        const allText = `${headline} ${bio}`;
        const foundKeywords = userKeywords.filter(k => allText.includes(k.toLowerCase()));
        const keywordRatio = userKeywords.length > 0 ? foundKeywords.length / userKeywords.length : 0;
        scores.keywords = Math.round(keywordRatio * 30);

        if (keywordRatio < 0.5) {
            const missing = userKeywords.filter(k => !allText.includes(k.toLowerCase()));
            recommendations.push(`Ajoute ces mots-clés : ${missing.slice(0, 3).join(', ')}`);
        }

        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

        return {
            platform: 'linkedin',
            totalScore,
            maxScore: 100,
            scores,
            issues,
            recommendations,
            summary: generateSummary(totalScore, 'LinkedIn')
        };
    }

    function auditInstagram(profile, userKeywords) {
        const scores = { username: 0, bio: 0, link: 0 };
        const issues = [];
        const recommendations = [];

        const username = profile.username || '';
        const bio = (profile.bio || '').toLowerCase();

        // Username (25 pts)
        const hasNumbers = /\d{3,}/.test(username);
        scores.username = hasNumbers ? 10 : 25;
        if (hasNumbers) {
            recommendations.push('Simplifie ton username (moins de chiffres)');
        }

        // Bio (50 pts)
        if (!bio) {
            issues.push({ severity: 'high', message: 'Pas de bio Instagram' });
            recommendations.push('Ajoute une bio claire avec ton expertise');
        } else {
            const hasExpertise = EXPERTISE_KEYWORDS.some(k => bio.includes(k));
            const hasCTA = bio.includes('👇') || bio.includes('lien');
            scores.bio = hasExpertise && hasCTA ? 50 : (hasExpertise ? 35 : 20);
        }

        // Link (25 pts)
        scores.link = profile.website ? 25 : 0;
        if (!profile.website) {
            recommendations.push('Ajoute un lien dans ta bio');
        }

        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

        return {
            platform: 'instagram',
            totalScore,
            maxScore: 100,
            scores,
            issues,
            recommendations,
            summary: generateSummary(totalScore, 'Instagram')
        };
    }

    function auditTikTok(profile, userKeywords) {
        const scores = { username: 0, bio: 0, link: 0 };
        const issues = [];
        const recommendations = [];

        const username = (profile.username || '').trim();
        const bio = (profile.bio || '').toLowerCase().trim();

        // Username (25 pts) - mais 0 si vide
        if (!username) {
            issues.push({ severity: 'high', message: 'Pas de username TikTok renseigné' });
            scores.username = 0;
        } else {
            const hasNumbers = /\d{4,}/.test(username);
            scores.username = username.length < 20 && !hasNumbers ? 25 : 15;
            if (hasNumbers) {
                recommendations.push('Simplifie ton username (moins de chiffres)');
            }
        }

        // Bio (50 pts)
        if (!bio) {
            issues.push({ severity: 'high', message: 'Pas de bio TikTok' });
            recommendations.push('Ajoute une bio claire avec ton expertise');
            scores.bio = 0;
        } else {
            const hasExpertise = EXPERTISE_KEYWORDS.some(k => bio.includes(k));
            scores.bio = hasExpertise ? 50 : 25;
            if (!hasExpertise) {
                recommendations.push('Ajoute des mots-clés d\'expertise dans ta bio');
            }
        }

        // Lien (25 pts)
        if (!profile.website) {
            recommendations.push('Ajoute un lien dans ta bio');
            scores.link = 0;
        } else {
            scores.link = 25;
        }

        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

        return {
            platform: 'tiktok',
            totalScore,
            maxScore: 100,
            scores,
            issues,
            recommendations,
            summary: generateSummary(totalScore, 'TikTok')
        };
    }

    function auditTwitter(profile, userKeywords) {
        const scores = { username: 0, bio: 0, link: 0 };
        const issues = [];
        const recommendations = [];

        const username = (profile.username || '').trim();
        const bio = (profile.bio || '').toLowerCase().trim();

        // Username (25 pts) - mais 0 si vide
        if (!username) {
            issues.push({ severity: 'high', message: 'Pas de username X/Twitter renseigné' });
            scores.username = 0;
        } else {
            const hasNumbers = /\d{4,}/.test(username);
            scores.username = !hasNumbers ? 25 : 15;
            if (hasNumbers) {
                recommendations.push('Simplifie ton username (moins de chiffres)');
            }
        }

        // Bio (50 pts)
        if (!bio) {
            issues.push({ severity: 'high', message: 'Pas de bio X/Twitter' });
            recommendations.push('Ajoute une bio claire avec ton expertise');
            scores.bio = 0;
        } else {
            const hasExpertise = EXPERTISE_KEYWORDS.some(k => bio.includes(k));
            scores.bio = hasExpertise ? 50 : 25;
            if (!hasExpertise) {
                recommendations.push('Ajoute des mots-clés d\'expertise dans ta bio');
            }
        }

        // Lien (25 pts)
        if (!profile.website) {
            recommendations.push('Ajoute un lien dans ta bio');
            scores.link = 0;
        } else {
            scores.link = 25;
        }

        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

        return {
            platform: 'twitter',
            totalScore,
            maxScore: 100,
            scores,
            issues,
            recommendations,
            summary: generateSummary(totalScore, 'X/Twitter')
        };
    }

    // ============================================================
    // AUDIT POSTS
    // ============================================================

    function analyzeHook(content) {
        const lines = content.trim().split('\n').filter(l => l.trim());
        const hook = lines[0] || '';

        let matchedType = null;
        let matchedScore = 0;

        for (const [type, config] of Object.entries(HOOK_PATTERNS)) {
            for (const pattern of config.patterns) {
                if (pattern.test(hook)) {
                    if (config.score > matchedScore) {
                        matchedType = type;
                        matchedScore = config.score;
                    }
                    break;
                }
            }
        }

        if (!matchedType) {
            matchedType = hook.length < 20 ? 'flatStatement' : 'neutral';
            matchedScore = hook.length < 20 ? 20 : 40;
        }

        const config = HOOK_PATTERNS[matchedType] || { name: 'Neutre', emoji: '➖' };

        return {
            text: hook,
            type: matchedType,
            typeName: config.name,
            emoji: config.emoji,
            score: matchedScore
        };
    }

    function analyzeStructure(content) {
        let score = 0;
        const recommendations = [];

        // Sauts de ligne
        const lineBreaks = (content.match(/\n/g) || []).length;
        if (lineBreaks >= 5) score += 25;
        else if (lineBreaks >= 3) score += 15;
        else {
            score += 5;
            recommendations.push('Aère ton post avec des sauts de ligne');
        }

        // Émojis
        const emojiCount = (content.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
        if (emojiCount >= 2 && emojiCount <= 10) score += 25;
        else if (emojiCount === 1 || emojiCount > 10) score += 15;
        else recommendations.push('Ajoute quelques émojis');

        // Longueur
        if (content.length >= 100 && content.length <= 1500) score += 25;
        else if (content.length < 100) {
            score += 10;
            recommendations.push('Post un peu court');
        } else {
            score += 15;
            recommendations.push('Post un peu long');
        }

        // Listes
        const hasBullets = /^[•\-→✓✅❌►\d+\.]/m.test(content);
        score += hasBullets ? 25 : 15;

        return { totalScore: Math.min(100, score), recommendations };
    }

    function analyzeCTA(content) {
        const fullContent = content.toLowerCase();

        for (const pattern of CTA_PATTERNS.strong.patterns) {
            if (pattern.test(fullContent)) {
                return { type: 'strong', score: 100, strength: 'Fort' };
            }
        }

        for (const pattern of CTA_PATTERNS.medium.patterns) {
            if (pattern.test(fullContent)) {
                return { type: 'medium', score: 60, strength: 'Moyen' };
            }
        }

        for (const pattern of CTA_PATTERNS.weak.patterns) {
            if (pattern.test(fullContent)) {
                return { type: 'weak', score: 30, strength: 'Faible' };
            }
        }

        return { type: 'none', score: 0, strength: 'Absent' };
    }

    function analyzeCoherence(content, userKeywords) {
        const contentLower = content.toLowerCase();
        const foundKeywords = userKeywords.filter(k => contentLower.includes(k.toLowerCase()));
        const ratio = userKeywords.length > 0 ? foundKeywords.length / userKeywords.length : 0;
        return {
            score: Math.round(ratio * 100),
            foundKeywords,
            missingKeywords: userKeywords.filter(k => !contentLower.includes(k.toLowerCase()))
        };
    }

    // ============================================================
    // NOUVEAUX CRITÈRES D'ANALYSE
    // ============================================================

    // Mots émotionnels français
    const EMOTION_WORDS = [
        'incroyable', 'extraordinaire', 'génial', 'terrible', 'horrible', 'magnifique',
        'passionné', 'passion', 'rêve', 'cauchemar', 'peur', 'angoisse', 'stress',
        'bonheur', 'joie', 'tristesse', 'colère', 'frustration', 'excité', 'fier',
        'honte', 'regret', 'espoir', 'confiance', 'doute', 'surprise', 'choc',
        'émotion', 'cœur', 'âme', 'larmes', 'sourire', 'rire', 'pleurer',
        'épuisé', 'motivé', 'inspiré', 'transformé', 'bouleversé', 'ému'
    ];

    // Patterns de storytelling
    const STORYTELLING_PATTERNS = [
        /il y a \d+/i, /l'année dernière/i, /hier/i, /ce matin/i, /un jour/i,
        /quand j'ai/i, /à mes débuts/i, /j'ai commencé/i, /mon histoire/i,
        /je me souviens/i, /c'était/i, /j'étais/i, /on m'a dit/i,
        /un client/i, /une cliente/i, /quelqu'un m'a/i, /j'ai rencontré/i,
        /j'ai découvert/i, /j'ai compris/i, /j'ai réalisé/i, /j'ai appris/i,
        /erreur/i, /échec/i, /leçon/i, /parcours/i, /chemin/i
    ];

    // Patterns de promesse/bénéfice
    const PROMISE_PATTERNS = [
        /tu vas/i, /vous allez/i, /tu pourras/i, /vous pourrez/i,
        /pour t'aider/i, /pour vous aider/i, /je t'aide/i, /je vous aide/i,
        /résultat/i, /bénéfice/i, /avantage/i, /solution/i,
        /en \d+ jours/i, /en \d+ semaines/i, /en \d+ étapes/i,
        /sans/i, /plus jamais/i, /fini le/i, /finie la/i,
        /gagner/i, /économiser/i, /obtenir/i, /atteindre/i, /réussir/i,
        /transformer/i, /améliorer/i, /booster/i, /multiplier/i,
        /secret/i, /méthode/i, /stratégie/i, /technique/i, /astuce/i
    ];

    function analyzeReadability(content) {
        const recommendations = [];
        let score = 0;

        // Séparer en phrases (approximatif)
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgSentenceLength = sentences.length > 0
            ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
            : 0;

        // Score longueur des phrases (idéal: 10-20 mots)
        if (avgSentenceLength >= 8 && avgSentenceLength <= 18) {
            score += 40;
        } else if (avgSentenceLength < 8) {
            score += 30;
            recommendations.push('Phrases très courtes - OK pour l\'impact, mais varie');
        } else if (avgSentenceLength <= 25) {
            score += 25;
            recommendations.push('Phrases un peu longues - découpe-les');
        } else {
            score += 10;
            recommendations.push('Phrases trop longues - difficile à lire sur mobile');
        }

        // Paragraphes courts (sauts de ligne)
        const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
        const shortParagraphs = paragraphs.filter(p => p.split(/\s+/).length <= 30).length;
        const paragraphRatio = paragraphs.length > 0 ? shortParagraphs / paragraphs.length : 0;

        if (paragraphRatio >= 0.8) {
            score += 30;
        } else if (paragraphRatio >= 0.5) {
            score += 20;
            recommendations.push('Certains paragraphes sont trop denses');
        } else {
            score += 10;
            recommendations.push('Aère tes paragraphes (max 2-3 phrases)');
        }

        // Présence de listes / structure claire
        const hasLists = /^[\-•→✓✅❌►\d+\.]/m.test(content);
        const hasLineBreaks = (content.match(/\n/g) || []).length >= 3;

        if (hasLists && hasLineBreaks) {
            score += 30;
        } else if (hasLists || hasLineBreaks) {
            score += 20;
        } else {
            score += 5;
            recommendations.push('Utilise des listes ou sauts de ligne');
        }

        return {
            score: Math.min(100, score),
            avgSentenceLength: Math.round(avgSentenceLength),
            recommendations
        };
    }

    function analyzeEmotion(content) {
        const contentLower = content.toLowerCase();
        const recommendations = [];
        let score = 0;

        // Compter les mots émotionnels
        const emotionCount = EMOTION_WORDS.filter(w => contentLower.includes(w)).length;

        if (emotionCount >= 3) {
            score += 50;
        } else if (emotionCount >= 1) {
            score += 30;
            recommendations.push('Ajoute plus de mots émotionnels pour créer du lien');
        } else {
            score += 10;
            recommendations.push('Ton post manque d\'émotion - ajoute du ressenti');
        }

        // Détecter les patterns de storytelling
        const storyPatterns = STORYTELLING_PATTERNS.filter(p => p.test(content)).length;

        if (storyPatterns >= 2) {
            score += 50;
        } else if (storyPatterns >= 1) {
            score += 30;
            recommendations.push('Développe ton storytelling avec plus de contexte');
        } else {
            score += 10;
            recommendations.push('Raconte une histoire - commence par "Un jour..." ou "Quand j\'ai..."');
        }

        // Bonus: présence du "je" / "tu" (connexion personnelle)
        const hasJe = /\bje\b/i.test(content);
        const hasTu = /\btu\b|\bvous\b/i.test(content);

        if (hasJe && hasTu) {
            score += 10; // Bonus connexion
        }

        return {
            score: Math.min(100, score),
            emotionCount,
            hasStorytelling: storyPatterns >= 1,
            recommendations
        };
    }

    function analyzePromiseClarity(content) {
        const contentLower = content.toLowerCase();
        const recommendations = [];
        let score = 0;

        // Détecter les patterns de promesse/bénéfice
        const promisePatterns = PROMISE_PATTERNS.filter(p => p.test(content)).length;

        if (promisePatterns >= 3) {
            score += 50;
        } else if (promisePatterns >= 1) {
            score += 30;
            recommendations.push('Renforce ta promesse - quel résultat concret ?');
        } else {
            score += 5;
            recommendations.push('Ajoute une promesse claire : "Tu vas obtenir X" ou "Résultat : Y"');
        }

        // Présence de chiffres (preuve, crédibilité)
        const hasNumbers = /\d+/.test(content);
        if (hasNumbers) {
            score += 25;
        } else {
            recommendations.push('Ajoute des chiffres pour plus de crédibilité');
        }

        // Présence d'une cible claire
        const hasTarget = /entrepreneur|solopreneur|freelance|coach|créat(eur|rice)|indépendant|business|client/i.test(content);
        if (hasTarget) {
            score += 25;
        } else {
            recommendations.push('Mentionne ta cible pour que les gens se reconnaissent');
        }

        return {
            score: Math.min(100, score),
            promisePatterns,
            hasNumbers,
            recommendations
        };
    }

    function analyzePost(content, userKeywords) {
        const hook = analyzeHook(content);
        const structure = analyzeStructure(content);
        const cta = analyzeCTA(content);
        const coherence = analyzeCoherence(content, userKeywords);
        const readability = analyzeReadability(content);
        const emotion = analyzeEmotion(content);
        const promise = analyzePromiseClarity(content);

        // Nouveau calcul avec 7 critères (pondération ajustée)
        const globalScore = Math.round(
            hook.score * 0.20 +
            structure.totalScore * 0.10 +
            cta.score * 0.15 +
            coherence.score * 0.15 +
            readability.score * 0.15 +
            emotion.score * 0.15 +
            promise.score * 0.10
        );

        return {
            globalScore,
            hook,
            structure,
            cta,
            coherence,
            readability,
            emotion,
            promise,
            summary: generatePostSummary(globalScore)
        };
    }

    // ============================================================
    // HELPERS
    // ============================================================

    function generateSummary(score, platform) {
        if (score >= 80) return { level: 'excellent', emoji: '🌟', message: `${platform} très bien optimisé !` };
        if (score >= 60) return { level: 'good', emoji: '✅', message: `${platform} correct, améliorations possibles` };
        if (score >= 40) return { level: 'average', emoji: '⚠️', message: `${platform} à optimiser` };
        return { level: 'poor', emoji: '🔴', message: `${platform} peu optimisé` };
    }

    function generatePostSummary(score) {
        if (score >= 80) return { level: 'excellent', emoji: '🌟', text: 'Excellent post !' };
        if (score >= 60) return { level: 'good', emoji: '✅', text: 'Bon post' };
        if (score >= 40) return { level: 'average', emoji: '⚠️', text: 'Post moyen' };
        return { level: 'poor', emoji: '🔴', text: 'À retravailler' };
    }

    function getScoreColor(score) {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#3b82f6';
        if (score >= 40) return '#f59e0b';
        return '#ef4444';
    }

    // ============================================================
    // MODAL UI
    // ============================================================

    let currentTab = 'profiles';
    let activePlatforms = { linkedin: true, instagram: false, tiktok: false, twitter: false };
    let profileData = {
        linkedin: { headline: '', summary: '', website: '' },
        instagram: { username: '', bio: '', website: '' },
        tiktok: { username: '', bio: '', website: '' },
        twitter: { username: '', bio: '', website: '' }
    };
    let userKeywords = [];
    let posts = [{ id: 1, content: '', platform: 'linkedin', image: null, imageName: '' }];
    let auditResults = null;
    let postsResults = null;

    // Nouveau : captures d'écran pour audit visuel
    let selectedPlatform = 'linkedin';
    let profileScreenshots = {
        profile: null,      // Capture du profil (photo + bannière + bio)
        posts: []           // Captures de 2-3 posts récents
    };
    let isAnalyzing = false;

    // Video audit (Gemini)
    let videoData = null;
    let videoResults = null;
    let videoPlatform = 'instagram';

    function openAuditModal() {
        // Restaurer les derniers résultats s'ils existent
        const savedResults = localStorage.getItem('tithot_last_audit_results');
        if (savedResults) {
            try {
                auditResults = JSON.parse(savedResults);
                if (auditResults.platform) {
                    selectedPlatform = auditResults.platform;
                }
            } catch (e) {
                auditResults = null;
            }
        } else {
            auditResults = null;
        }
        postsResults = null;
        videoResults = null;

        const modalHTML = `
            <div class="audit-modal-overlay" id="auditModalOverlay" onclick="AuditModule.closeModal(event)">
                <div class="audit-modal" onclick="event.stopPropagation()">
                    <div class="audit-modal-header">
                        <h2>📊 Audit Réseaux Sociaux</h2>
                        <button class="audit-close-btn" onclick="AuditModule.closeModal()">&times;</button>
                    </div>

                    <div class="audit-tabs">
                        <button class="audit-tab active" data-tab="profiles" onclick="AuditModule.switchTab('profiles')">
                            👤 Profils
                        </button>
                        <button class="audit-tab" data-tab="posts" onclick="AuditModule.switchTab('posts')">
                            📝 Posts
                        </button>
                        <button class="audit-tab" data-tab="videos" onclick="AuditModule.switchTab('videos')">
                            🎬 Reels & Vidéos
                        </button>
                    </div>

                    <div class="audit-content" id="auditContent">
                        ${renderProfilesTab()}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        setTimeout(() => {
            const overlay = document.getElementById('auditModalOverlay');
            if (overlay) overlay.classList.add('active');
        }, 10);

        // Activer le collage d'images (Ctrl+V)
        initPasteEvents();
    }

    function closeModal(e) {
        if (e && e.target !== e.currentTarget) return;
        const overlay = document.getElementById('auditModalOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        }
        // Désactiver le collage d'images
        cleanupPasteEvents();
    }

    function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.audit-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        const content = document.getElementById('auditContent');
        if (content) {
            if (tab === 'profiles') {
                content.innerHTML = auditResults ? renderProfilesResults() : renderProfilesTab();
            } else if (tab === 'posts') {
                content.innerHTML = postsResults ? renderPostsResults() : renderPostsTab();
            } else if (tab === 'videos') {
                content.innerHTML = videoResults ? renderVideosResults() : renderVideosTab();
            }
        }
    }

    function renderProfilesTab() {
        const platformInfo = PLATFORMS[selectedPlatform];

        return `
            <div class="audit-section">
                <div class="audit-info-box">
                    <h4>📸 Audit visuel de ton profil</h4>
                    <p>Upload <strong>une capture d'écran complète</strong> de ton profil et l'IA analysera :</p>
                    <ul>
                        <li><strong>Photo de profil</strong> - Professionnelle ? Regard caméra ?</li>
                        <li><strong>Bannière</strong> - Cohérente avec ton activité ?</li>
                        <li><strong>Bio/À propos</strong> - Claire et impactante ?</li>
                        <li><strong>Cohérence visuelle</strong> - Tes posts sont-ils harmonieux ?</li>
                        <li><strong>Impression générale</strong> - Ce qu'un visiteur ressent</li>
                    </ul>
                </div>
            </div>

            <div class="audit-section">
                <h3>1️⃣ Choisis ta plateforme</h3>
                <p class="audit-hint" style="margin-bottom: 12px;">L'analyse est adaptée aux codes spécifiques de chaque réseau (taille photo, format bio, etc.)</p>
                <div class="audit-platforms">
                    ${Object.entries(PLATFORMS).map(([key, p]) => `
                        <button class="audit-platform-btn ${selectedPlatform === key ? 'active' : ''}"
                                onclick="AuditModule.selectPlatform('${key}')">
                            <span class="platform-emoji">${p.emoji}</span>
                            <span>${p.name}</span>
                            ${selectedPlatform === key ? '<span class="check">✓</span>' : ''}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="audit-section">
                <h3>2️⃣ Capture complète de ton profil ${platformInfo.emoji}</h3>
                <p class="audit-hint">📱 <strong>Fais UNE seule capture d'écran</strong> montrant : photo, bannière ET bio visibles en même temps.</p>
                <div class="screenshot-upload-zone" onclick="document.getElementById('profileScreenshot').click()">
                    ${profileScreenshots.profile ? `
                        <img src="${profileScreenshots.profile.data}" alt="Capture profil" class="screenshot-preview">
                        <button class="screenshot-remove" onclick="event.stopPropagation(); AuditModule.removeProfileScreenshot()">✕</button>
                    ` : `
                        <div class="screenshot-placeholder">
                            <span class="screenshot-icon">📷</span>
                            <span>Clique, glisse ou colle (Ctrl+V)</span>
                            <span class="screenshot-hint">PNG, JPG (max 5MB)</span>
                        </div>
                    `}
                </div>
                <input type="file" id="profileScreenshot" accept="image/*" style="display: none;"
                       onchange="AuditModule.handleProfileScreenshot(this)">
            </div>

            <div class="audit-section">
                <h3>3️⃣ Captures de tes posts récents <span class="optional-tag">optionnel</span></h3>
                <p class="audit-hint">2-3 captures pour analyser la cohérence visuelle (clique ou Ctrl+V)</p>
                <div class="screenshots-grid">
                    ${profileScreenshots.posts.map((post, idx) => `
                        <div class="screenshot-item">
                            <img src="${post.data}" alt="Post ${idx + 1}">
                            <button class="screenshot-remove" onclick="AuditModule.removePostScreenshot(${idx})">✕</button>
                        </div>
                    `).join('')}
                    ${profileScreenshots.posts.length < 3 ? `
                        <div class="screenshot-upload-small" onclick="document.getElementById('postScreenshot').click()">
                            <span>+ Ajouter ou Ctrl+V</span>
                        </div>
                    ` : ''}
                </div>
                <input type="file" id="postScreenshot" accept="image/*" style="display: none;"
                       onchange="AuditModule.handlePostScreenshot(this)">
            </div>

            <div class="audit-section">
                <h3>4️⃣ Ton domaine d'expertise <span class="optional-tag">optionnel</span></h3>
                <input type="text" id="auditKeywords" class="audit-input"
                       placeholder="Ex: coach business, marketing digital, copywriting..."
                       value="${userKeywords.join(', ')}"
                       onchange="AuditModule.updateKeywords(this.value)">
                <p class="audit-hint">Aide l'IA à vérifier si ton profil reflète ton expertise</p>
            </div>

            <button class="audit-run-btn ${!profileScreenshots.profile ? 'disabled' : ''}"
                    onclick="AuditModule.runVisualAudit()"
                    ${!profileScreenshots.profile ? 'disabled' : ''}>
                ${isAnalyzing ? '<span class="loading-spinner"></span> Analyse en cours...' : '🤖 Analyser avec l\'IA'}
            </button>

            ${!profileScreenshots.profile ? '<p class="audit-hint" style="text-align: center; margin-top: 10px;">Ajoute au moins la capture de ton profil</p>' : ''}

            <div class="audit-info-feedback" style="margin-top: 15px; padding: 12px; background: linear-gradient(135deg, #e0f2fe, #f0f9ff); border-radius: 10px; border-left: 4px solid #0ea5e9;">
                <p style="margin: 0; color: #0369a1; font-size: 0.9em;">
                    ⏱️ <strong>~30 secondes</strong> • 📄 Rapport avec score et recommandations • 💾 Sauvegardé automatiquement
                </p>
            </div>
        `;
    }

    function renderProfilesResults() {
        if (!auditResults) return '';

        // Cas d'erreur / fallback
        if (auditResults.error) {
            return `
                <div class="audit-results">
                    ${auditResults.fallbackMessage || ''}
                    <button class="audit-reset-btn" onclick="AuditModule.resetProfilesAudit()">
                        ← Retour
                    </button>
                </div>
            `;
        }

        // Résultats de l'audit visuel IA
        if (auditResults.visualAnalysis || auditResults.analysis) {
            const analysis = auditResults.visualAnalysis || auditResults.analysis;
            const platform = PLATFORMS[auditResults.platform] || PLATFORMS.linkedin;
            const colorPalette = auditResults.colorPalette;
            const quickWins = auditResults.quickWins;

            return `
                <div class="audit-results">
                    <div class="audit-score-global">
                        <div class="score-circle" style="--score-color: ${getScoreColor(auditResults.globalScore)}">
                            <span class="score-value">${auditResults.globalScore || 0}</span>
                            <span class="score-max">/100</span>
                        </div>
                        <h3>${platform.emoji} Résultat de l'audit</h3>
                        <p>${auditResults.summary?.message || 'Analyse terminée'}</p>
                    </div>

                    ${analysis.photo ? `
                        <div class="audit-visual-section">
                            <h4>📷 Photo de profil</h4>
                            <div class="visual-score">
                                <span class="score-badge" style="background: ${getScoreColor(analysis.photo.score)}">${analysis.photo.score}/100</span>
                            </div>
                            <p>${analysis.photo.feedback || ''}</p>
                        </div>
                    ` : ''}

                    ${analysis.banner ? `
                        <div class="audit-visual-section">
                            <h4>🖼️ Bannière</h4>
                            <div class="visual-score">
                                <span class="score-badge" style="background: ${getScoreColor(analysis.banner.score)}">${analysis.banner.score}/100</span>
                            </div>
                            <p>${analysis.banner.feedback || ''}</p>
                        </div>
                    ` : ''}

                    ${analysis.grid ? `
                        <div class="audit-visual-section">
                            <h4>📱 Grille & Highlights</h4>
                            <div class="visual-score">
                                <span class="score-badge" style="background: ${getScoreColor(analysis.grid.score)}">${analysis.grid.score}/100</span>
                            </div>
                            <p>${analysis.grid.feedback || ''}</p>
                        </div>
                    ` : ''}

                    ${analysis.bio ? `
                        <div class="audit-visual-section">
                            <h4>✍️ Bio / Titre</h4>
                            <div class="visual-score">
                                <span class="score-badge" style="background: ${getScoreColor(analysis.bio.score)}">${analysis.bio.score}/100</span>
                            </div>
                            <p>${analysis.bio.feedback || ''}</p>
                        </div>
                    ` : ''}

                    ${analysis.colors ? `
                        <div class="audit-visual-section">
                            <h4>🎨 Palette de couleurs</h4>
                            <div class="visual-score">
                                <span class="score-badge" style="background: ${getScoreColor(analysis.colors.score)}">${analysis.colors.score}/100</span>
                            </div>
                            <p>${analysis.colors.feedback || ''}</p>
                            ${colorPalette ? `
                                <div class="color-palette-display">
                                    <div class="detected-colors">
                                        ${(colorPalette.detected || []).map(c => `<span class="color-chip" title="${c}">${c}</span>`).join('')}
                                    </div>
                                    <p class="palette-harmony ${colorPalette.harmony === 'harmonieuse' ? 'good' : colorPalette.harmony === 'discordante' ? 'bad' : 'neutral'}">
                                        Harmonie : ${colorPalette.harmony || 'non évaluée'}
                                    </p>
                                    ${colorPalette.suggestion ? `<p class="palette-suggestion">💡 ${colorPalette.suggestion}</p>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

                    ${analysis.typography ? `
                        <div class="audit-visual-section">
                            <h4>🔤 Typographie & Design</h4>
                            <div class="visual-score">
                                <span class="score-badge" style="background: ${getScoreColor(analysis.typography.score)}">${analysis.typography.score}/100</span>
                            </div>
                            <p>${analysis.typography.feedback || ''}</p>
                        </div>
                    ` : ''}

                    ${analysis.branding ? `
                        <div class="audit-visual-section">
                            <h4>🏷️ Branding & Reconnaissance</h4>
                            <div class="visual-score">
                                <span class="score-badge" style="background: ${getScoreColor(analysis.branding.score)}">${analysis.branding.score}/100</span>
                            </div>
                            <p>${analysis.branding.feedback || ''}</p>
                        </div>
                    ` : ''}

                    ${analysis.storytelling ? `
                        <div class="audit-visual-section">
                            <h4>✨ Storytelling & Personnalité</h4>
                            <div class="visual-score">
                                <span class="score-badge" style="background: ${getScoreColor(analysis.storytelling.score)}">${analysis.storytelling.score}/100</span>
                            </div>
                            <p>${analysis.storytelling.feedback || ''}</p>
                        </div>
                    ` : ''}

                    ${analysis.posts ? `
                        <div class="audit-visual-section">
                            <h4>📝 Posts analysés</h4>
                            <div class="visual-score">
                                <span class="score-badge" style="background: ${getScoreColor(analysis.posts.score)}">${analysis.posts.score}/100</span>
                            </div>
                            <p>${analysis.posts.feedback || ''}</p>
                        </div>
                    ` : ''}

                    ${quickWins && quickWins.length > 0 ? `
                        <div class="audit-section quick-wins-section">
                            <h4>⚡ Quick Wins (5 min max)</h4>
                            <div class="quick-wins-list">
                                ${quickWins.map(qw => `
                                    <div class="quick-win-item">
                                        <span class="qw-icon">✓</span>
                                        <p>${qw}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${auditResults.recommendations && auditResults.recommendations.length > 0 ? `
                        <div class="audit-section">
                            <h4>🎯 Actions prioritaires</h4>
                            <div class="audit-recommendations-list">
                                ${auditResults.recommendations.map((rec, idx) => `
                                    <div class="recommendation-item ${idx === 0 ? 'high' : ''}">
                                        <span class="rec-number">${idx + 1}</span>
                                        <p>${rec}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <button class="audit-reset-btn" onclick="AuditModule.resetProfilesAudit()">
                        Analyser un autre profil
                    </button>
                </div>
            `;
        }

        // Ancien format (audit texte) - garder pour rétrocompatibilité
        return `
            <div class="audit-results">
                <div class="audit-score-global">
                    <div class="score-circle" style="--score-color: ${getScoreColor(auditResults.globalScore)}">
                        <span class="score-value">${auditResults.globalScore}</span>
                        <span class="score-max">/100</span>
                    </div>
                    <h3>Score Global</h3>
                    <p>${auditResults.summary.message}</p>
                </div>

                ${auditResults.platformAudits ? Object.entries(auditResults.platformAudits).map(([platform, audit]) => `
                    <div class="audit-platform-result">
                        <div class="platform-header">
                            <span>${PLATFORMS[platform].emoji} ${PLATFORMS[platform].name}</span>
                            <span class="platform-score" style="color: ${getScoreColor(audit.totalScore)}">${audit.totalScore}/100</span>
                        </div>

                        ${audit.issues && audit.issues.length > 0 ? `
                            <div class="audit-issues">
                                ${audit.issues.map(i => `
                                    <div class="audit-issue ${i.severity}">
                                        <span class="issue-icon">${i.severity === 'high' ? '🔴' : '⚠️'}</span>
                                        ${i.message}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}

                        ${audit.recommendations && audit.recommendations.length > 0 ? `
                            <div class="audit-recommendations">
                                <strong>Recommandations :</strong>
                                <ul>
                                    ${audit.recommendations.map(r => `<li>${r}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                `).join('') : ''}

                <button class="audit-reset-btn" onclick="AuditModule.resetProfilesAudit()">
                    Recommencer l'audit
                </button>
            </div>
        `;
    }

    function renderPostsTab() {
        return `
            <div class="audit-section">
                <div class="audit-info-box">
                    <h4>📝 Analyse complète de tes posts</h4>
                    <p>7 critères analysés :</p>
                    <ul>
                        <li><strong>🎣 Accroche</strong> - Captive-t-elle ?</li>
                        <li><strong>📐 Structure</strong> - Lisible et aéré ?</li>
                        <li><strong>🎯 CTA</strong> - Incite à l'action ?</li>
                        <li><strong>🔗 Cohérence</strong> - Parle de ton expertise ?</li>
                        <li><strong>📖 Lisibilité</strong> - Facile à lire sur mobile ?</li>
                        <li><strong>💜 Émotion</strong> - Crée du lien avec ton audience ?</li>
                        <li><strong>💎 Promesse</strong> - Bénéfice clair pour le lecteur ?</li>
                    </ul>
                </div>
            </div>

            <div class="audit-section">
                <h3>🎯 Tes mots-clés d'expertise</h3>
                <input type="text" id="auditPostsKeywords" class="audit-input"
                       placeholder="marketing, copywriting, LinkedIn..."
                       value="${userKeywords.join(', ')}"
                       onchange="AuditModule.updateKeywords(this.value)">
            </div>

            <div class="audit-section">
                <div class="audit-posts-header">
                    <h3>📋 Tes posts <span class="posts-count-badge">${posts.length}/5 max</span></h3>
                    <button class="audit-add-btn" onclick="AuditModule.addPost()" ${posts.length >= 5 ? 'disabled style="opacity:0.5"' : ''}>+ Ajouter</button>
                </div>

                <div class="audit-posts-list">
                    ${posts.map((post, idx) => `
                        <div class="audit-post-item">
                            <div class="post-item-header">
                                <span class="post-number">${idx + 1}</span>
                                <select class="audit-select" onchange="AuditModule.updatePost(${post.id}, 'platform', this.value)">
                                    <option value="linkedin" ${post.platform === 'linkedin' ? 'selected' : ''}>LinkedIn</option>
                                    <option value="instagram" ${post.platform === 'instagram' ? 'selected' : ''}>Instagram</option>
                                    <option value="tiktok" ${post.platform === 'tiktok' ? 'selected' : ''}>TikTok</option>
                                    <option value="twitter" ${post.platform === 'twitter' ? 'selected' : ''}>X/Twitter</option>
                                </select>
                                ${posts.length > 1 ? `<button class="audit-remove-btn" onclick="AuditModule.removePost(${post.id})">🗑️</button>` : ''}
                            </div>
                            <textarea class="audit-textarea post-textarea"
                                      placeholder="Colle ton post ici..."
                                      onchange="AuditModule.updatePost(${post.id}, 'content', this.value)">${post.content}</textarea>
                            <div class="post-item-footer">
                                <span class="char-count">${post.content.length} caractères</span>
                                <div class="image-upload-zone">
                                    <label class="image-upload-btn" for="imageUpload-${post.id}">
                                        ${post.imageName ? `🖼️ ${post.imageName}` : '📷 Ajouter visuel'}
                                    </label>
                                    <input type="file" id="imageUpload-${post.id}" accept="image/*" style="display: none;"
                                           onchange="AuditModule.handleImageUpload(${post.id}, this)">
                                    ${post.imageName ? `<button class="image-remove-btn" onclick="AuditModule.removeImage(${post.id})">✕</button>` : ''}
                                </div>
                            </div>
                            ${post.image ? `
                                <div class="image-preview">
                                    <img src="${post.image}" alt="Aperçu">
                                    <div class="image-analysis-note">🔮 Analyse visuelle bientôt disponible</div>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>

            <button class="audit-run-btn" onclick="AuditModule.runPostsAnalysis()">
                📊 Analyser mes posts
            </button>

            <div class="audit-info-feedback" style="margin-top: 15px; padding: 12px; background: linear-gradient(135deg, #e0f2fe, #f0f9ff); border-radius: 10px; border-left: 4px solid #0ea5e9;">
                <p style="margin: 0; color: #0369a1; font-size: 0.9em;">
                    ⏱️ <strong>~1-2 min</strong> selon le nombre de posts • 📄 Scores par critère + conseils • 💾 Sauvegardé automatiquement
                </p>
            </div>
        `;
    }

    function renderPostsResults() {
        if (!postsResults) return '';

        const avgScores = postsResults.averageScores;

        return `
            <div class="audit-results">
                <div class="audit-score-global">
                    <div class="score-circle" style="--score-color: ${getScoreColor(avgScores.global)}">
                        <span class="score-value">${avgScores.global}</span>
                        <span class="score-max">/100</span>
                    </div>
                    <h3>Score Moyen</h3>
                    <p>Basé sur ${postsResults.postCount} post${postsResults.postCount > 1 ? 's' : ''}</p>
                </div>

                <div class="audit-scores-grid audit-scores-7">
                    <div class="score-item">
                        <span class="score-emoji">🎣</span>
                        <span class="score-label">Accroche</span>
                        <span class="score-value" style="color: ${getScoreColor(avgScores.hook)}">${avgScores.hook}</span>
                    </div>
                    <div class="score-item">
                        <span class="score-emoji">📐</span>
                        <span class="score-label">Structure</span>
                        <span class="score-value" style="color: ${getScoreColor(avgScores.structure)}">${avgScores.structure}</span>
                    </div>
                    <div class="score-item">
                        <span class="score-emoji">🎯</span>
                        <span class="score-label">CTA</span>
                        <span class="score-value" style="color: ${getScoreColor(avgScores.cta)}">${avgScores.cta}</span>
                    </div>
                    <div class="score-item">
                        <span class="score-emoji">🔗</span>
                        <span class="score-label">Cohérence</span>
                        <span class="score-value" style="color: ${getScoreColor(avgScores.coherence)}">${avgScores.coherence}</span>
                    </div>
                    <div class="score-item">
                        <span class="score-emoji">📖</span>
                        <span class="score-label">Lisibilité</span>
                        <span class="score-value" style="color: ${getScoreColor(avgScores.readability)}">${avgScores.readability}</span>
                    </div>
                    <div class="score-item">
                        <span class="score-emoji">💜</span>
                        <span class="score-label">Émotion</span>
                        <span class="score-value" style="color: ${getScoreColor(avgScores.emotion)}">${avgScores.emotion}</span>
                    </div>
                    <div class="score-item">
                        <span class="score-emoji">💎</span>
                        <span class="score-label">Promesse</span>
                        <span class="score-value" style="color: ${getScoreColor(avgScores.promise)}">${avgScores.promise}</span>
                    </div>
                </div>

                ${postsResults.globalRecommendations && postsResults.globalRecommendations.length > 0 ? `
                    <div class="audit-section">
                        <h4>🎯 Recommandations prioritaires</h4>
                        <div class="audit-recommendations-list">
                            ${postsResults.globalRecommendations.map(rec => `
                                <div class="recommendation-item ${rec.priority}">
                                    <span class="rec-category">${rec.category}</span>
                                    <p>${rec.message}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="audit-section">
                    <h4>📋 Détail par post</h4>
                    ${postsResults.detailedAnalysis.map((post, idx) => `
                        <div class="post-detail">
                            <div class="post-detail-header">
                                <span class="post-score" style="background: ${getScoreColor(post.globalScore)}">${post.globalScore}</span>
                                <span>Post ${idx + 1} - ${post.summary.text}</span>
                            </div>
                            <div class="post-detail-scores">
                                <span class="mini-score" style="color: ${getScoreColor(post.hook.score)}">🎣 ${post.hook.score}</span>
                                <span class="mini-score" style="color: ${getScoreColor(post.structure.totalScore)}">📐 ${post.structure.totalScore}</span>
                                <span class="mini-score" style="color: ${getScoreColor(post.cta.score)}">🎯 ${post.cta.score}</span>
                                <span class="mini-score" style="color: ${getScoreColor(post.readability.score)}">📖 ${post.readability.score}</span>
                                <span class="mini-score" style="color: ${getScoreColor(post.emotion.score)}">💜 ${post.emotion.score}</span>
                                <span class="mini-score" style="color: ${getScoreColor(post.promise.score)}">💎 ${post.promise.score}</span>
                            </div>
                            <div class="post-detail-content">
                                <p><strong>Accroche :</strong> ${post.hook.emoji} ${post.hook.typeName}</p>
                                <p><strong>CTA :</strong> ${post.cta.strength}</p>
                                ${post.emotion.hasStorytelling ? '<p>✅ Storytelling détecté</p>' : '<p>❌ Pas de storytelling</p>'}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <button class="audit-reset-btn" onclick="AuditModule.resetPostsAnalysis()">
                    Analyser d'autres posts
                </button>
            </div>
        `;
    }

    // ============================================================
    // ACTIONS
    // ============================================================

    function togglePlatform(platform) {
        activePlatforms[platform] = !activePlatforms[platform];
        switchTab('profiles');
    }

    function selectPlatform(platform) {
        selectedPlatform = platform;
        switchTab('profiles');
    }

    // ============================================================
    // SCREENSHOT HANDLING
    // ============================================================

    function handleProfileScreenshot(input) {
        const file = input.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Seules les images sont acceptées');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Image trop lourde (max 5MB)');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            profileScreenshots.profile = {
                data: e.target.result,
                name: file.name,
                type: file.type
            };
            switchTab('profiles');
        };
        reader.readAsDataURL(file);
    }

    function handlePostScreenshot(input) {
        const file = input.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Seules les images sont acceptées');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Image trop lourde (max 5MB)');
            return;
        }

        if (profileScreenshots.posts.length >= 3) {
            alert('Maximum 3 captures de posts');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            profileScreenshots.posts.push({
                data: e.target.result,
                name: file.name,
                type: file.type
            });
            switchTab('profiles');
        };
        reader.readAsDataURL(file);
    }

    // Gestion du collage (Ctrl+V) pour les captures de profil
    function handlePasteImage(event) {
        const items = event.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();

                if (file.size > 5 * 1024 * 1024) {
                    alert('Image trop lourde (max 5MB)');
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    // Si on est sur l'onglet profils et pas de capture profil, c'est une capture profil
                    if (currentTab === 'profiles' && !profileScreenshots.profile) {
                        profileScreenshots.profile = {
                            data: e.target.result,
                            name: 'capture-collee.png',
                            type: file.type
                        };
                    }
                    // Sinon, si on a déjà un profil et moins de 3 posts, c'est un post
                    else if (currentTab === 'profiles' && profileScreenshots.posts.length < 3) {
                        profileScreenshots.posts.push({
                            data: e.target.result,
                            name: 'capture-collee.png',
                            type: file.type
                        });
                    }
                    switchTab('profiles');
                };
                reader.readAsDataURL(file);
                break;
            }
        }
    }

    // Initialiser les événements de collage quand le modal est ouvert
    function initPasteEvents() {
        document.addEventListener('paste', handlePasteImage);
    }

    // Nettoyer les événements quand le modal est fermé
    function cleanupPasteEvents() {
        document.removeEventListener('paste', handlePasteImage);
    }

    function removeProfileScreenshot() {
        profileScreenshots.profile = null;
        switchTab('profiles');
    }

    function removePostScreenshot(index) {
        profileScreenshots.posts.splice(index, 1);
        switchTab('profiles');
    }

    // ============================================================
    // VISUAL AUDIT (via API)
    // ============================================================

    async function runVisualAudit() {
        if (!profileScreenshots.profile) {
            alert('Ajoute au moins une capture de ton profil');
            return;
        }

        // Vérifier la limite freemium (audit profil)
        if (window.FreemiumSystem && !window.FreemiumSystem.canDoAuditProfile()) {
            window.FreemiumSystem.showPaywall('auditProfile');
            return;
        }

        isAnalyzing = true;
        switchTab('profiles');

        try {
            // Préparer les données pour l'API
            const auditData = {
                platform: selectedPlatform,
                keywords: userKeywords,
                profileImage: profileScreenshots.profile.data,
                postImages: profileScreenshots.posts.map(p => p.data)
            };

            // Appel à l'API (worker)
            const response = await fetch(CONFIG.API_URL + '/audit-visual', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(auditData)
            });

            if (!response.ok) {
                throw new Error('Erreur API: ' + response.status);
            }

            const result = await response.json();

            // Stocker les résultats (format du worker)
            auditResults = {
                globalScore: result.globalScore || 0,
                summary: result.summary || { message: 'Audit terminé' },
                analysis: result.analysis || {},
                recommendations: result.recommendations || [],
                platform: selectedPlatform
            };

            // Incrémenter le compteur d'audits pour la gamification
            const currentAudits = parseInt(localStorage.getItem('tithot_audits_count') || '0');
            localStorage.setItem('tithot_audits_count', currentAudits + 1);
            const currentProfileAudits = parseInt(localStorage.getItem('tithot_profile_audits') || '0');
            localStorage.setItem('tithot_profile_audits', currentProfileAudits + 1);

            // Incrémenter le compteur freemium (audit profil)
            if (window.FreemiumSystem) {
                window.FreemiumSystem.incrementAuditProfile();
            }

            // Sauvegarder les résultats pour ne pas les perdre
            localStorage.setItem('tithot_last_audit_results', JSON.stringify(auditResults));
            localStorage.setItem('tithot_last_audit_date', new Date().toISOString());

        } catch (error) {
            console.error('Erreur audit visuel:', error);

            // Fallback : afficher un message d'erreur sympa
            auditResults = {
                globalScore: null,
                error: true,
                summary: { message: 'L\'analyse IA n\'est pas encore disponible' },
                fallbackMessage: `
                    <div class="audit-fallback">
                        <h4>🚧 Fonctionnalité en cours de déploiement</h4>
                        <p>L'audit visuel par IA sera bientôt disponible !</p>
                        <p>En attendant, voici quelques conseils généraux pour ${PLATFORMS[selectedPlatform].name} :</p>
                        <ul>
                            <li><strong>Photo de profil</strong> : visage visible, fond neutre, sourire naturel</li>
                            <li><strong>Bannière</strong> : cohérente avec ton activité, pas trop chargée</li>
                            <li><strong>Bio</strong> : qui tu aides + comment + résultat</li>
                            <li><strong>Posts</strong> : cohérence visuelle (couleurs, style)</li>
                        </ul>
                    </div>
                `,
                platform: selectedPlatform
            };
        }

        isAnalyzing = false;
        switchTab('profiles');
    }

    function updateKeywords(value) {
        userKeywords = value.split(',').map(k => k.trim()).filter(k => k.length > 0);
    }

    function updateProfileData(platform, field, value) {
        profileData[platform][field] = value;
    }

    function addPost() {
        const newId = Math.max(...posts.map(p => p.id), 0) + 1;
        posts.push({ id: newId, content: '', platform: 'linkedin', image: null, imageName: '' });
        switchTab('posts');
    }

    function handleImageUpload(postId, input) {
        const file = input.files[0];
        if (!file) return;

        // Vérifier le type
        if (!file.type.startsWith('image/')) {
            alert('Seules les images sont acceptées');
            return;
        }

        // Vérifier la taille (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image trop lourde (max 5MB)');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const post = posts.find(p => p.id === postId);
            if (post) {
                post.image = e.target.result;
                post.imageName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
                switchTab('posts');
            }
        };
        reader.readAsDataURL(file);
    }

    function removeImage(postId) {
        const post = posts.find(p => p.id === postId);
        if (post) {
            post.image = null;
            post.imageName = '';
            switchTab('posts');
        }
    }

    function removePost(id) {
        posts = posts.filter(p => p.id !== id);
        switchTab('posts');
    }

    function updatePost(id, field, value) {
        const post = posts.find(p => p.id === id);
        if (post) post[field] = value;
    }

    function runProfilesAudit() {
        const audits = {};

        if (activePlatforms.linkedin) {
            audits.linkedin = auditLinkedIn(profileData.linkedin, userKeywords);
        }
        if (activePlatforms.instagram) {
            audits.instagram = auditInstagram(profileData.instagram, userKeywords);
        }
        if (activePlatforms.tiktok) {
            audits.tiktok = auditTikTok(profileData.tiktok, userKeywords);
        }
        if (activePlatforms.twitter) {
            audits.twitter = auditTwitter(profileData.twitter, userKeywords);
        }

        if (Object.keys(audits).length === 0) {
            alert('Sélectionne au moins une plateforme !');
            return;
        }

        // Calculate global score
        let totalWeight = 0;
        let weightedSum = 0;

        Object.entries(audits).forEach(([platform, audit]) => {
            const weight = PLATFORMS[platform]?.weight || 1;
            weightedSum += audit.totalScore * weight;
            totalWeight += weight;
        });

        const globalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

        auditResults = {
            platformAudits: audits,
            globalScore,
            summary: generateSummary(globalScore, 'Présence sociale')
        };

        switchTab('profiles');
    }

    function resetProfilesAudit() {
        auditResults = null;
        switchTab('profiles');
    }

    function runPostsAnalysis() {
        const validPosts = posts.filter(p => p.content.trim().length > 20);

        if (validPosts.length === 0) {
            alert('Ajoute au moins un post avec du contenu (min. 20 caractères)');
            return;
        }

        // Vérifier la limite freemium (audit posts)
        if (window.FreemiumSystem && !window.FreemiumSystem.canDoAuditPosts()) {
            window.FreemiumSystem.showPaywall('auditPosts');
            return;
        }

        const analyzedPosts = validPosts.map(post => analyzePost(post.content, userKeywords));

        // 7 critères maintenant
        const avgScores = {
            global: 0, hook: 0, structure: 0, cta: 0, coherence: 0,
            readability: 0, emotion: 0, promise: 0
        };

        analyzedPosts.forEach(post => {
            avgScores.global += post.globalScore;
            avgScores.hook += post.hook.score;
            avgScores.structure += post.structure.totalScore;
            avgScores.cta += post.cta.score;
            avgScores.coherence += post.coherence.score;
            avgScores.readability += post.readability.score;
            avgScores.emotion += post.emotion.score;
            avgScores.promise += post.promise.score;
        });

        const count = analyzedPosts.length;
        Object.keys(avgScores).forEach(key => {
            avgScores[key] = Math.round(avgScores[key] / count);
        });

        // Generate recommendations (7 critères)
        const globalRecommendations = [];

        if (avgScores.hook < 60) {
            globalRecommendations.push({
                priority: 'high',
                category: 'Accroches',
                message: 'Tes accroches manquent d\'impact. Utilise des questions, histoires ou chiffres.'
            });
        }

        if (avgScores.cta < 50) {
            globalRecommendations.push({
                priority: 'high',
                category: 'CTA',
                message: 'Ajoute un appel à l\'action clair à chaque post.'
            });
        }

        if (avgScores.emotion < 50) {
            globalRecommendations.push({
                priority: 'high',
                category: 'Émotion',
                message: 'Tes posts manquent d\'émotion. Raconte des histoires, partage ton ressenti.'
            });
        }

        if (avgScores.promise < 50) {
            globalRecommendations.push({
                priority: 'medium',
                category: 'Promesse',
                message: 'Clarifie le bénéfice pour ton lecteur. Que va-t-il gagner ?'
            });
        }

        if (avgScores.readability < 60) {
            globalRecommendations.push({
                priority: 'medium',
                category: 'Lisibilité',
                message: 'Aère tes posts : phrases courtes, listes, sauts de ligne.'
            });
        }

        if (avgScores.coherence < 50) {
            globalRecommendations.push({
                priority: 'medium',
                category: 'Cohérence',
                message: 'Tes posts ne parlent pas assez de ton expertise. Inclus tes mots-clés.'
            });
        }

        postsResults = {
            postCount: count,
            averageScores: avgScores,
            globalRecommendations,
            detailedAnalysis: analyzedPosts
        };

        // Incrémenter le compteur freemium (audit posts)
        if (window.FreemiumSystem) {
            window.FreemiumSystem.incrementAuditPosts();
        }

        switchTab('posts');
    }

    function resetPostsAnalysis() {
        postsResults = null;
        switchTab('posts');
    }

    // ============================================================
    // VIDEO AUDIT (Gemini)
    // ============================================================

    function renderVideosTab() {
        return `
            <div class="audit-section">
                <div class="audit-info-box">
                    <h4>🎬 Audit de Reels & Vidéos courtes</h4>
                    <p>Upload ta vidéo et l'IA analysera :</p>
                    <ul>
                        <li><strong>Hook</strong> - Les 3 premières secondes captent-elles l'attention ?</li>
                        <li><strong>Rythme</strong> - Le montage est-il dynamique ?</li>
                        <li><strong>Audio</strong> - Qualité du son, musique, voix off</li>
                        <li><strong>Textes</strong> - Lisibilité, timing d'apparition</li>
                        <li><strong>Structure</strong> - Intro → Contenu → CTA</li>
                        <li><strong>Potentiel viral</strong> - Score d'engagement prévu</li>
                    </ul>
                </div>
            </div>

            <div class="audit-section">
                <h3>1️⃣ Plateforme</h3>
                <div class="platform-selector">
                    ${['instagram', 'tiktok', 'youtube', 'linkedin'].map(p => `
                        <button class="platform-btn ${videoPlatform === p ? 'active' : ''}"
                                onclick="AuditModule.selectVideoPlatform('${p}')">
                            ${PLATFORMS[p]?.emoji || '📱'} ${p === 'youtube' ? 'YouTube Shorts' : PLATFORMS[p]?.name || p}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="audit-section">
                <h3>2️⃣ Upload ta vidéo</h3>
                <div class="video-upload-zone ${videoData ? 'has-video' : ''}"
                     onclick="document.getElementById('videoInput').click()">
                    ${videoData ? `
                        <video class="video-preview" controls>
                            <source src="${videoData.preview}" type="${videoData.mimeType}">
                        </video>
                        <div class="video-info">
                            <strong>${videoData.name}</strong> (${(videoData.size / 1024 / 1024).toFixed(1)} MB)
                            <button class="remove-btn" onclick="event.stopPropagation(); AuditModule.removeVideo()">✕ Supprimer</button>
                        </div>
                    ` : `
                        <span style="font-size: 3em;">🎥</span>
                        <p>Clique ou glisse ta vidéo ici</p>
                        <p class="audit-hint">MP4, MOV, WebM - Max 50MB, durée max 90 secondes</p>
                    `}
                </div>
                <input type="file" id="videoInput" accept="video/*" style="display: none;"
                       onchange="AuditModule.handleVideoUpload(this)">
            </div>

            <div class="audit-section">
                <h3>3️⃣ Ton domaine <span class="optional-tag">optionnel</span></h3>
                <input type="text" id="videoKeywords" class="audit-input"
                       placeholder="Ex: fitness, marketing digital, cuisine..."
                       value="${userKeywords.join(', ')}"
                       onchange="AuditModule.updateKeywords(this.value)">
            </div>

            <button class="audit-run-btn ${!videoData ? 'disabled' : ''}"
                    onclick="AuditModule.runVideoAudit()"
                    ${!videoData ? 'disabled' : ''}>
                ${isAnalyzing ? '<span class="loading-spinner"></span> Analyse en cours...' : '🎬 Analyser ma vidéo'}
            </button>

            ${!videoData ? '<p class="audit-hint" style="text-align: center; margin-top: 10px;">Upload une vidéo pour lancer l\'analyse</p>' : ''}

            <div class="audit-info-feedback" style="margin-top: 15px; padding: 12px; background: linear-gradient(135deg, #e0f2fe, #f0f9ff); border-radius: 10px; border-left: 4px solid #0ea5e9;">
                <p style="margin: 0; color: #0369a1; font-size: 0.9em;">
                    ⏱️ <strong>~1-2 min</strong> • 📄 Analyse hook, rythme, CTA + score détaillé • 💾 Sauvegardé automatiquement
                </p>
            </div>
        `;
    }

    function renderVideosResults() {
        if (!videoResults) return renderVideosTab();

        // Cas d'erreur
        if (videoResults.error) {
            return `
                <div class="audit-results">
                    <div class="audit-error">
                        <h4>❌ Erreur d'analyse</h4>
                        <p>${videoResults.message || 'Une erreur est survenue'}</p>
                    </div>
                    <button class="audit-reset-btn" onclick="AuditModule.resetVideoAudit()">
                        ← Réessayer
                    </button>
                </div>
            `;
        }

        const analysis = videoResults.analysis || {};
        const viralClass = {
            'très élevé': 'high',
            'élevé': 'high',
            'moyen': 'medium',
            'faible': 'low'
        }[videoResults.viralPotential?.toLowerCase()] || 'medium';

        return `
            <div class="audit-results">
                <div class="audit-score-global">
                    <div class="score-circle" style="--score-color: ${getScoreColor(videoResults.globalScore)}">
                        <span class="score-value">${videoResults.globalScore || 0}</span>
                        <span class="score-max">/100</span>
                    </div>
                    <h3>🎬 Audit ${videoPlatform === 'youtube' ? 'YouTube Short' : videoPlatform === 'instagram' ? 'Reel' : 'Vidéo'}</h3>
                    <p>${videoResults.summary?.message || 'Analyse terminée'}</p>
                    <span class="viral-potential ${viralClass}">
                        🔥 Potentiel viral : ${videoResults.viralPotential || 'non évalué'}
                    </span>
                </div>

                ${analysis.hook ? `
                    <div class="audit-visual-section">
                        <h4>⚡ Hook (3 premières secondes)</h4>
                        <div class="visual-score">
                            <span class="score-badge" style="background: ${getScoreColor(analysis.hook.score)}">${analysis.hook.score}/100</span>
                        </div>
                        <p>${analysis.hook.feedback || ''}</p>
                    </div>
                ` : ''}

                ${analysis.pacing ? `
                    <div class="audit-visual-section">
                        <h4>🎵 Rythme & Montage</h4>
                        <div class="visual-score">
                            <span class="score-badge" style="background: ${getScoreColor(analysis.pacing.score)}">${analysis.pacing.score}/100</span>
                        </div>
                        <p>${analysis.pacing.feedback || ''}</p>
                    </div>
                ` : ''}

                ${analysis.audio ? `
                    <div class="audit-visual-section">
                        <h4>🔊 Audio & Son</h4>
                        <div class="visual-score">
                            <span class="score-badge" style="background: ${getScoreColor(analysis.audio.score)}">${analysis.audio.score}/100</span>
                        </div>
                        <p>${analysis.audio.feedback || ''}</p>
                    </div>
                ` : ''}

                ${analysis.text ? `
                    <div class="audit-visual-section">
                        <h4>📝 Textes à l'écran</h4>
                        <div class="visual-score">
                            <span class="score-badge" style="background: ${getScoreColor(analysis.text.score)}">${analysis.text.score}/100</span>
                        </div>
                        <p>${analysis.text.feedback || ''}</p>
                    </div>
                ` : ''}

                ${analysis.structure ? `
                    <div class="audit-visual-section">
                        <h4>📖 Structure narrative</h4>
                        <div class="visual-score">
                            <span class="score-badge" style="background: ${getScoreColor(analysis.structure.score)}">${analysis.structure.score}/100</span>
                        </div>
                        <p>${analysis.structure.feedback || ''}</p>
                    </div>
                ` : ''}

                ${analysis.visual ? `
                    <div class="audit-visual-section">
                        <h4>🎨 Qualité visuelle</h4>
                        <div class="visual-score">
                            <span class="score-badge" style="background: ${getScoreColor(analysis.visual.score)}">${analysis.visual.score}/100</span>
                        </div>
                        <p>${analysis.visual.feedback || ''}</p>
                    </div>
                ` : ''}

                ${analysis.engagement ? `
                    <div class="audit-visual-section">
                        <h4>💬 Potentiel d'engagement</h4>
                        <div class="visual-score">
                            <span class="score-badge" style="background: ${getScoreColor(analysis.engagement.score)}">${analysis.engagement.score}/100</span>
                        </div>
                        <p>${analysis.engagement.feedback || ''}</p>
                    </div>
                ` : ''}

                ${videoResults.optimalDuration ? `
                    <div class="audit-section">
                        <p><strong>⏱️ Durée recommandée :</strong> ${videoResults.optimalDuration}</p>
                    </div>
                ` : ''}

                ${videoResults.recommendations && videoResults.recommendations.length > 0 ? `
                    <div class="audit-section">
                        <h4>🎯 Actions prioritaires</h4>
                        <div class="audit-recommendations-list">
                            ${videoResults.recommendations.map((rec, idx) => `
                                <div class="recommendation-item ${idx === 0 ? 'high' : ''}">
                                    <span class="rec-number">${idx + 1}</span>
                                    <p>${rec}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <button class="audit-reset-btn" onclick="AuditModule.resetVideoAudit()">
                    Analyser une autre vidéo
                </button>
            </div>
        `;
    }

    function selectVideoPlatform(platform) {
        videoPlatform = platform;
        switchTab('videos');
    }

    function handleVideoUpload(input) {
        const file = input.files[0];
        if (!file) return;

        // Vérifier le type
        if (!file.type.startsWith('video/')) {
            alert('Seules les vidéos sont acceptées');
            return;
        }

        // Vérifier la taille (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
            alert('Vidéo trop lourde (max 50MB)');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            videoData = {
                data: e.target.result,
                preview: URL.createObjectURL(file),
                name: file.name,
                size: file.size,
                mimeType: file.type
            };
            switchTab('videos');
        };
        reader.readAsDataURL(file);
    }

    function removeVideo() {
        if (videoData?.preview) {
            URL.revokeObjectURL(videoData.preview);
        }
        videoData = null;
        switchTab('videos');
    }

    async function runVideoAudit() {
        if (!videoData) {
            alert('Upload une vidéo d\'abord');
            return;
        }

        // Vérifier la limite freemium (audit vidéo)
        if (window.FreemiumSystem && !window.FreemiumSystem.canDoAuditVideo()) {
            window.FreemiumSystem.showPaywall('auditVideo');
            return;
        }

        isAnalyzing = true;
        switchTab('videos');

        try {
            const response = await fetch(CONFIG.API_URL + '/audit-video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    platform: videoPlatform,
                    videoData: videoData.data,
                    videoMimeType: videoData.mimeType,
                    keywords: userKeywords
                })
            });

            if (!response.ok) {
                throw new Error('Erreur API: ' + response.status);
            }

            const result = await response.json();
            videoResults = result;

            // Incrémenter le compteur d'audits pour la gamification
            const currentAudits = parseInt(localStorage.getItem('tithot_audits_count') || '0');
            localStorage.setItem('tithot_audits_count', currentAudits + 1);

            // Incrémenter le compteur freemium (audit vidéo)
            if (window.FreemiumSystem) {
                window.FreemiumSystem.incrementAuditVideo();
            }

        } catch (error) {
            console.error('Erreur audit vidéo:', error);
            videoResults = {
                error: true,
                message: 'L\'analyse vidéo n\'est pas disponible. Vérifie que ta clé Gemini est configurée.'
            };
        }

        isAnalyzing = false;
        switchTab('videos');
    }

    function resetVideoAudit() {
        videoResults = null;
        switchTab('videos');
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    return {
        openAuditModal,
        closeModal,
        switchTab,
        togglePlatform,
        selectPlatform,
        updateKeywords,
        updateProfileData,
        addPost,
        removePost,
        updatePost,
        handleImageUpload,
        removeImage,
        handleProfileScreenshot,
        handlePostScreenshot,
        removeProfileScreenshot,
        removePostScreenshot,
        runProfilesAudit,
        resetProfilesAudit,
        runVisualAudit,
        runPostsAnalysis,
        resetPostsAnalysis,
        // Video audit
        selectVideoPlatform,
        handleVideoUpload,
        removeVideo,
        runVideoAudit,
        resetVideoAudit
    };

})();

// Expose globally
window.AuditModule = AuditModule;
