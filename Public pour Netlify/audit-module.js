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
        console.log('🔍 analyzeCoherence appelé avec', userKeywords.length, 'mots-clés:', userKeywords);

        // Normaliser le contenu (enlever accents, mettre en minuscules)
        const normalizeText = (text) => {
            return text
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
                .replace(/['']/g, ' ') // Remplacer apostrophes par espaces
                .replace(/[^a-z0-9\s]/g, ' ') // Garder seulement lettres, chiffres, espaces
                .replace(/\s+/g, ' ') // Normaliser les espaces multiples
                .trim();
        };

        const contentNormalized = normalizeText(content);
        const contentWords = contentNormalized.split(/\s+/).filter(w => w.length > 2);
        console.log('📝 Contenu normalisé (premiers 200 chars):', contentNormalized.substring(0, 200));
        console.log('📝 Mots du contenu:', contentWords.slice(0, 30), '...');

        // Vérifier chaque mot-clé avec matching flexible
        const foundKeywords = [];
        const missingKeywords = [];

        userKeywords.forEach(keyword => {
            const keywordNormalized = normalizeText(keyword);
            const keywordWords = keywordNormalized.split(/\s+/).filter(w => w.length > 2);

            // Vérifier si le mot-clé ou ses variantes sont présents
            let found = false;
            let matchType = '';

            // 1. Match exact
            if (contentNormalized.includes(keywordNormalized)) {
                found = true;
                matchType = 'exact';
            }

            // 2. Match partiel avec radicals courts (pour gérer pluriels, conjugaisons, dérivés)
            if (!found) {
                for (const kw of keywordWords) {
                    if (kw.length >= 4) {
                        // Utiliser un radical plus court (4-5 caractères max) pour plus de flexibilité
                        // "gamifiees" → "gamif" matchera "gamification"
                        // "formation" → "forma" matchera "formation", "former", etc.
                        const radical = kw.slice(0, Math.min(5, Math.max(4, Math.floor(kw.length * 0.6))));
                        if (contentWords.some(w => w.startsWith(radical) || w.includes(radical))) {
                            found = true;
                            matchType = `radical:${radical}`;
                            break;
                        }
                    }
                }
            }

            // 3. Match par mot individuel (pour expressions composées)
            if (!found && keywordWords.length > 1) {
                const matchedWords = keywordWords.filter(kw =>
                    kw.length >= 3 && contentWords.some(w => w.includes(kw) || kw.includes(w))
                );
                if (matchedWords.length >= Math.ceil(keywordWords.length / 2)) {
                    found = true;
                    matchType = `mots:${matchedWords.join(',')}`;
                }
            }

            // 4. Match par sous-chaîne (si un mot du contenu contient le keyword ou vice versa)
            if (!found) {
                for (const kw of keywordWords) {
                    if (kw.length >= 4) {
                        // Vérifier si le mot-clé est contenu dans un mot du contenu ou vice versa
                        const matchingWord = contentWords.find(w =>
                            (w.length >= 5 && kw.length >= 5 && (w.includes(kw.slice(0, 4)) || kw.includes(w.slice(0, 4))))
                        );
                        if (matchingWord) {
                            found = true;
                            matchType = `substring:${matchingWord}`;
                            break;
                        }
                    }
                }
            }

            if (found) {
                foundKeywords.push(keyword);
                console.log(`✅ Mot-clé trouvé: "${keyword}" (${matchType})`);
            } else {
                missingKeywords.push(keyword);
                console.log(`❌ Mot-clé manquant: "${keyword}" (normalisé: "${keywordNormalized}")`);
            }
        });

        const ratio = userKeywords.length > 0 ? foundKeywords.length / userKeywords.length : 0;
        const score = Math.round(ratio * 100);
        console.log(`📊 Score cohérence: ${score}% (${foundKeywords.length}/${userKeywords.length})`);

        return {
            score,
            foundKeywords,
            missingKeywords
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
    let posts = [{ id: 1, content: '', platform: 'linkedin', images: [] }]; // images: [{data, name}]
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

    // ============================================================
    // CHARGEMENT DES MOTS-CLÉS DEPUIS L'ONBOARDING
    // ============================================================

    function loadKeywordsFromProfile() {
        try {
            const profileData = localStorage.getItem('voyageCreatifUserProfile');
            console.log('🔍 Profile data found:', !!profileData);
            if (!profileData) {
                console.log('⚠️ Aucun profil trouvé dans localStorage');
                return;
            }

            const profile = JSON.parse(profileData);
            console.log('📋 Profile parsed:', {
                domaine: profile.domaine,
                piliers: profile.piliers,
                tags: profile.tags,
                specialite: profile.specialite,
                expertise: profile.expertise
            });
            const keywords = [];

            // Ajouter le domaine d'expertise (garder les expressions complètes)
            if (profile.domaine) {
                console.log('📌 Domaine trouvé:', profile.domaine);
                // Séparer par virgules mais garder les expressions
                profile.domaine.split(',').forEach(d => {
                    const trimmed = d.trim();
                    if (trimmed && trimmed.length >= 2) {
                        keywords.push(trimmed);
                        // Aussi ajouter les mots individuels si l'expression est longue
                        // Séparer par espaces ET apostrophes pour extraire chaque mot
                        const words = trimmed.split(/[\s']+/);
                        words.forEach(word => {
                            if (word.length >= 4) keywords.push(word);
                        });
                    }
                });
            }

            // Ajouter aussi specialite et expertise si présents
            ['specialite', 'expertise', 'metier'].forEach(field => {
                if (profile[field]) {
                    console.log(`📌 ${field} trouvé:`, profile[field]);
                    profile[field].split(',').forEach(d => {
                        const trimmed = d.trim();
                        if (trimmed && trimmed.length >= 2) {
                            keywords.push(trimmed);
                            const words = trimmed.split(/[\s']+/);
                            words.forEach(word => {
                                if (word.length >= 4) keywords.push(word);
                            });
                        }
                    });
                }
            });

            // Ajouter les piliers de contenu
            if (Array.isArray(profile.piliers)) {
                console.log('📌 Piliers trouvés:', profile.piliers);
                profile.piliers.forEach(p => {
                    if (p && p.trim() && p.trim().length >= 2) {
                        keywords.push(p.trim());
                    }
                });
            }

            // Ajouter les tags (hashtags et mots-clés)
            if (profile.tags) {
                console.log('📌 Tags trouvés:', profile.tags);
                // Nettoyer les # et séparer par espaces/virgules
                profile.tags.split(/[\s,]+/).forEach(tag => {
                    const cleaned = tag.replace(/^#/, '').trim();
                    if (cleaned && cleaned.length >= 2) keywords.push(cleaned);
                });
            }

            // NE PAS extraire les mots du message unique (trop de bruit)

            // Dédupliquer les mots-clés (insensible à la casse)
            const seen = new Set();
            userKeywords = keywords.filter(k => {
                const lower = k.toLowerCase().trim();
                if (seen.has(lower) || lower.length < 2) return false;
                seen.add(lower);
                return true;
            });

            console.log('✅ Mots-clés finaux chargés depuis onboarding:', userKeywords);
            console.log('📊 Nombre total de mots-clés:', userKeywords.length);
        } catch (e) {
            console.error('❌ Erreur chargement mots-clés profil:', e);
        }
    }

    // ============================================================
    // HISTORIQUE DES AUDITS
    // ============================================================

    const AUDIT_HISTORY_KEY = 'tithot_audit_history';
    const MAX_HISTORY_ITEMS = 20;
    let showingHistory = false;

    function getAuditHistory() {
        try {
            const history = localStorage.getItem(AUDIT_HISTORY_KEY);
            return history ? JSON.parse(history) : [];
        } catch (e) {
            console.error('Erreur lecture historique:', e);
            return [];
        }
    }

    function saveToHistory(type, results, platform) {
        try {
            const history = getAuditHistory();

            // Créer l'entrée d'historique
            const entry = {
                id: Date.now(),
                date: new Date().toISOString(),
                type: type, // 'profile', 'posts', 'video'
                platform: platform,
                score: results.globalScore || results.averageScores?.global || 0,
                summary: type === 'profile'
                    ? results.summary?.message
                    : type === 'video'
                        ? results.summary?.message
                        : `${results.postCount || 0} post(s) analysé(s)`,
                results: results
            };

            // Ajouter au début
            history.unshift(entry);

            // Limiter la taille
            if (history.length > MAX_HISTORY_ITEMS) {
                history.splice(MAX_HISTORY_ITEMS);
            }

            localStorage.setItem(AUDIT_HISTORY_KEY, JSON.stringify(history));
            return true;
        } catch (e) {
            console.error('Erreur sauvegarde historique:', e);
            return false;
        }
    }

    function deleteFromHistory(id) {
        try {
            const history = getAuditHistory();
            const newHistory = history.filter(item => item.id !== id);
            localStorage.setItem(AUDIT_HISTORY_KEY, JSON.stringify(newHistory));
            showHistory(); // Rafraîchir la vue
        } catch (e) {
            console.error('Erreur suppression historique:', e);
        }
    }

    function loadFromHistory(id) {
        try {
            const history = getAuditHistory();
            const entry = history.find(item => item.id === id);
            if (!entry) return;

            showingHistory = false;

            // Restaurer les résultats selon le type
            if (entry.type === 'profile') {
                auditResults = entry.results;
                selectedPlatform = entry.platform;
                switchTab('profiles');
            } else if (entry.type === 'posts') {
                postsResults = entry.results;
                switchTab('posts');
            } else if (entry.type === 'video') {
                videoResults = entry.results;
                videoPlatform = entry.platform;
                switchTab('videos');
            }
        } catch (e) {
            console.error('Erreur chargement historique:', e);
        }
    }

    function showHistory() {
        showingHistory = true;
        const content = document.getElementById('auditContent');
        if (content) {
            content.innerHTML = renderHistoryView();
        }
        // Désactiver l'onglet actif visuellement
        document.querySelectorAll('.audit-tab').forEach(btn => btn.classList.remove('active'));
    }

    function hideHistory() {
        showingHistory = false;
        switchTab(currentTab);
    }

    function renderHistoryView() {
        const history = getAuditHistory();

        if (history.length === 0) {
            return `
                <div class="audit-history-empty">
                    <div class="empty-icon">📋</div>
                    <h3>Aucun audit sauvegardé</h3>
                    <p>Tes audits seront automatiquement sauvegardés ici après chaque analyse.</p>
                    <button class="audit-btn" onclick="AuditModule.hideHistory()">
                        ← Retour aux audits
                    </button>
                </div>
            `;
        }

        const typeIcons = {
            'profile': '👤',
            'posts': '📝',
            'video': '🎬'
        };

        const typeLabels = {
            'profile': 'Profil',
            'posts': 'Posts',
            'video': 'Vidéo'
        };

        return `
            <div class="audit-history-view">
                <div class="history-header">
                    <h3>📋 Mes audits (${history.length})</h3>
                    <button class="audit-btn-secondary" onclick="AuditModule.hideHistory()">
                        ← Retour
                    </button>
                </div>

                <div class="history-list">
                    ${history.map(item => {
                        const date = new Date(item.date);
                        const dateStr = date.toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                        });
                        const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                        const platformInfo = PLATFORMS[item.platform] || { emoji: '📊', name: item.platform };

                        return `
                            <div class="history-item" onclick="AuditModule.loadFromHistory(${item.id})">
                                <div class="history-item-left">
                                    <span class="history-type-badge">${typeIcons[item.type] || '📊'} ${typeLabels[item.type] || item.type}</span>
                                    <span class="history-platform">${platformInfo.emoji} ${platformInfo.name}</span>
                                </div>
                                <div class="history-item-center">
                                    <div class="history-score" style="color: ${getScoreColor(item.score)}">
                                        ${item.score}/100
                                    </div>
                                    <div class="history-summary">${item.summary || ''}</div>
                                </div>
                                <div class="history-item-right">
                                    <div class="history-date">${dateStr}</div>
                                    <div class="history-time">${timeStr}</div>
                                    <button class="history-delete-btn" onclick="event.stopPropagation(); AuditModule.deleteFromHistory(${item.id})" title="Supprimer">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    function openAuditModal() {
        // Charger les mots-clés depuis le profil onboarding
        loadKeywordsFromProfile();

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
            <div class="audit-modal-overlay" id="auditModalOverlay" onmousedown="AuditModule.handleOverlayMouseDown(event)" onmouseup="AuditModule.handleOverlayMouseUp(event)">
                <div class="audit-modal" onmousedown="event.stopPropagation()" onmouseup="event.stopPropagation()">
                    <div class="audit-modal-header">
                        <h2>📊 Audit Réseaux Sociaux</h2>
                        <div class="audit-header-actions">
                            <button class="audit-history-btn" onclick="AuditModule.showHistory()" title="Voir mes audits sauvegardés">
                                📋 Mes audits
                            </button>
                            <button class="audit-close-btn" onclick="AuditModule.closeModal()">&times;</button>
                        </div>
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

    // Variable pour gérer le clic sur l'overlay (éviter fermeture lors de sélection de texte)
    let mouseDownOnOverlay = false;

    function handleOverlayMouseDown(e) {
        // Vérifie si le mousedown est directement sur l'overlay (pas sur le contenu)
        mouseDownOnOverlay = e.target.id === 'auditModalOverlay';
    }

    function handleOverlayMouseUp(e) {
        // Ferme seulement si mousedown ET mouseup sont sur l'overlay
        if (mouseDownOnOverlay && e.target.id === 'auditModalOverlay') {
            closeModal();
        }
        mouseDownOnOverlay = false;
    }

    function closeModal(e) {
        // Si appelé avec un événement click, ignorer (on utilise mousedown/mouseup maintenant)
        if (e && e.type === 'click' && e.target.id === 'auditModalOverlay') return;
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
                                    <label class="image-upload-btn" for="imageUpload-${post.id}" ${(post.images?.length || 0) >= 10 ? 'style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                                        📷 Ajouter visuel${(post.images?.length || 0) > 0 ? ` (${post.images.length}/10)` : ''}
                                    </label>
                                    <input type="file" id="imageUpload-${post.id}" accept="image/*" multiple style="display: none;"
                                           onchange="AuditModule.handleImageUpload(${post.id}, this)" ${(post.images?.length || 0) >= 10 ? 'disabled' : ''}>
                                </div>
                            </div>
                            ${post.images?.length > 0 ? `
                                <div class="images-preview" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
                                    ${post.images.map((img, imgIdx) => `
                                        <div class="image-preview-item" style="position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 2px solid #e0e0e0;">
                                            <img src="${img.data}" alt="Visuel ${imgIdx + 1}" style="width: 100%; height: 100%; object-fit: cover;">
                                            <button onclick="AuditModule.removeImage(${post.id}, ${imgIdx})"
                                                    style="position: absolute; top: 2px; right: 2px; background: rgba(239,68,68,0.9); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px; line-height: 1;">✕</button>
                                        </div>
                                    `).join('')}
                                </div>
                                <div class="image-analysis-note" style="color: #059669; font-size: 0.85em; margin-top: 5px;">🔮 ${post.images.length} visuel(s) analysé(s) par l'IA</div>
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

                ${postsResults.aiPatterns ? `
                    <div class="audit-section" style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                        <h4>🔮 Analyse IA - Patterns détectés</h4>
                        ${postsResults.aiPatterns.strengths?.length ? `
                            <div style="margin-bottom: 10px;">
                                <strong style="color: #059669;">✅ Points forts :</strong>
                                <ul style="margin: 5px 0; padding-left: 20px;">
                                    ${postsResults.aiPatterns.strengths.map(s => `<li>${s}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${postsResults.aiPatterns.weaknesses?.length ? `
                            <div>
                                <strong style="color: #dc2626;">🎯 À améliorer :</strong>
                                <ul style="margin: 5px 0; padding-left: 20px;">
                                    ${postsResults.aiPatterns.weaknesses.map(w => `<li>${w}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="audit-section">
                    <h4>📋 Détail par post ${postsResults.hasAiAnalysis ? '<span style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75em; margin-left: 8px;">🔮 IA</span>' : ''}</h4>
                    ${postsResults.detailedAnalysis.map((post, idx) => `
                        <div class="post-detail" style="border: 1px solid #e0e0e0; border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                            <div class="post-detail-header">
                                <span class="post-score" style="background: ${getScoreColor(post.globalScore)}">${post.globalScore}</span>
                                <span>Post ${idx + 1} - ${post.aiSuggestions?.summary || post.summary?.text || 'Analyse complète'}</span>
                            </div>
                            <div class="post-detail-scores">
                                <span class="mini-score" style="color: ${getScoreColor(post.hook?.score || 0)}">🎣 ${post.hook?.score || 0}</span>
                                <span class="mini-score" style="color: ${getScoreColor(post.structure?.totalScore || 0)}">📐 ${post.structure?.totalScore || 0}</span>
                                <span class="mini-score" style="color: ${getScoreColor(post.cta?.score || 0)}">🎯 ${post.cta?.score || 0}</span>
                                <span class="mini-score" style="color: ${getScoreColor(post.readability?.score || 0)}">📖 ${post.readability?.score || 0}</span>
                                <span class="mini-score" style="color: ${getScoreColor(post.emotion?.score || 0)}">💜 ${post.emotion?.score || 0}</span>
                                <span class="mini-score" style="color: ${getScoreColor(post.promise?.score || 0)}">💎 ${post.promise?.score || 0}</span>
                            </div>

                            ${post.aiSuggestions?.topPriority ? `
                                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 12px; margin: 12px 0; border-radius: 0 8px 8px 0;">
                                    <strong>🎯 Priorité :</strong> ${post.aiSuggestions.topPriority}
                                </div>
                            ` : ''}

                            <div class="post-detail-content" style="margin-top: 12px; display: block !important;">
                                <div style="margin-bottom: 15px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #667eea;">
                                    <p style="margin: 0 0 8px 0; color: #1f2937; font-size: 0.95em; display: block;">
                                        <strong style="color: #4f46e5;">🎣 Accroche :</strong> ${post.hook?.score || 0}/100 - ${post.hook?.emoji || '📝'} ${post.hook?.typeName || 'Standard'}
                                    </p>
                                    <p style="color: #6b7280; font-size: 0.9em; margin: 8px 0; display: block;">
                                        ${post.hook?.score >= 80 ? '✅ Excellente accroche qui capte l\'attention !' :
                                          post.hook?.score >= 60 ? '👍 Bonne accroche, mais peut être améliorée avec plus d\'impact.' :
                                          post.hook?.score >= 40 ? '⚠️ Accroche moyenne. Elle ne se démarque pas assez dans le fil d\'actualité.' :
                                          '❌ Accroche faible. Elle ne donne pas envie de lire la suite.'}
                                    </p>
                                    ${post.hook?.score < 80 && !post.aiSuggestions?.improvedHook ? `
                                        <div style="background: #eff6ff; border-radius: 8px; padding: 10px; margin-top: 8px;">
                                            <strong style="color: #2563eb;">💡 Exemples d'accroches efficaces :</strong>
                                            <ul style="margin: 5px 0; padding-left: 20px; color: #1e40af; font-size: 0.9em;">
                                                <li>"J'ai fait cette erreur pendant 3 ans..."</li>
                                                <li>"Pourquoi 90% des entrepreneurs échouent ?"</li>
                                                <li>"Ce matin, un client m'a dit quelque chose qui m'a choqué."</li>
                                                <li>"3 choses que j'aurais aimé savoir avant de me lancer"</li>
                                            </ul>
                                        </div>
                                    ` : ''}
                                    ${post.aiSuggestions?.hookFeedback ? `<p style="color: #4f46e5; font-size: 0.9em; margin: 8px 0; display: block;">🔮 ${post.aiSuggestions.hookFeedback}</p>` : ''}
                                    ${post.aiSuggestions?.improvedHook ? `
                                        <div style="background: #ecfdf5; border-radius: 8px; padding: 10px; margin-top: 8px;">
                                            <strong style="color: #059669;">💡 Version améliorée :</strong>
                                            <p style="margin: 5px 0; font-style: italic; color: #065f46;">"${post.aiSuggestions.improvedHook}"</p>
                                        </div>
                                    ` : ''}
                                </div>

                                <div style="margin-bottom: 15px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #f59e0b;">
                                    <p style="margin: 0 0 8px 0; color: #1f2937; font-size: 0.95em; display: block;">
                                        <strong style="color: #d97706;">🎯 CTA :</strong> ${post.cta?.score || 0}/100 - ${post.cta?.strength || 'Non détecté'}
                                    </p>
                                    <p style="color: #6b7280; font-size: 0.9em; margin: 8px 0; display: block;">
                                        ${post.cta?.score >= 80 ? '✅ CTA puissant qui incite à l\'action !' :
                                          post.cta?.score >= 50 ? '👍 CTA présent mais peut être plus engageant.' :
                                          post.cta?.score > 0 ? '⚠️ CTA faible. Il manque d\'énergie et de clarté.' :
                                          '❌ Pas de CTA détecté. Ton lecteur ne sait pas quoi faire après avoir lu.'}
                                    </p>
                                    ${post.cta?.score < 80 && !post.aiSuggestions?.ctaAlternatives?.length ? `
                                        <div style="background: #fef3c7; border-radius: 8px; padding: 10px; margin-top: 8px;">
                                            <strong style="color: #d97706;">💡 Exemples de CTA efficaces :</strong>
                                            <ul style="margin: 5px 0; padding-left: 20px; color: #92400e; font-size: 0.9em;">
                                                <li>"Commente 🔥 si tu veux que je développe"</li>
                                                <li>"Partage à quelqu'un qui a besoin de lire ça"</li>
                                                <li>"Tu veux la suite ? Dis-le moi en commentaire"</li>
                                                <li>"Enregistre ce post pour ne pas l'oublier 📌"</li>
                                                <li>"Quel point te parle le plus ? 1, 2 ou 3 ?"</li>
                                            </ul>
                                        </div>
                                    ` : ''}
                                    ${post.aiSuggestions?.ctaFeedback ? `<p style="color: #d97706; font-size: 0.9em; margin: 8px 0; display: block;">🔮 ${post.aiSuggestions.ctaFeedback}</p>` : ''}
                                    ${post.aiSuggestions?.ctaAlternatives?.length ? `
                                        <div style="background: #eff6ff; border-radius: 8px; padding: 10px; margin-top: 8px;">
                                            <strong style="color: #2563eb;">💡 CTA alternatifs :</strong>
                                            <ul style="margin: 5px 0; padding-left: 20px; color: #1e40af;">
                                                ${post.aiSuggestions.ctaAlternatives.map(cta => `<li>${cta}</li>`).join('')}
                                            </ul>
                                        </div>
                                    ` : ''}
                                </div>

                                <div style="margin-bottom: 15px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #8b5cf6;">
                                    <p style="margin: 0 0 8px 0; color: #1f2937; font-size: 0.95em; display: block;">
                                        <strong style="color: #7c3aed;">💜 Émotion :</strong> ${post.emotion?.score || 0}/100 - ${post.emotion?.hasStorytelling ? 'Storytelling détecté' : 'Pas de storytelling'}
                                    </p>
                                    <p style="color: #6b7280; font-size: 0.9em; margin: 8px 0; display: block;">
                                        ${post.emotion?.score >= 70 ? '✅ Ton post crée une connexion émotionnelle forte !' :
                                          post.emotion?.score >= 50 ? '👍 Quelques éléments émotionnels, mais tu peux créer plus de connexion.' :
                                          post.emotion?.score >= 30 ? '⚠️ Peu d\'émotion. Ton post reste en surface.' :
                                          '❌ Post trop factuel. Il ne crée pas de lien avec ton audience.'}
                                    </p>
                                    ${post.emotion?.score < 70 && !post.aiSuggestions?.emotionSuggestion ? `
                                        <div style="background: #fdf4ff; border-radius: 8px; padding: 10px; margin-top: 8px;">
                                            <strong style="color: #a855f7;">💡 Comment ajouter de l'émotion :</strong>
                                            <ul style="margin: 5px 0; padding-left: 20px; color: #6b21a8; font-size: 0.9em;">
                                                <li><strong>Raconte un échec :</strong> "J'ai perdu mon premier client parce que..."</li>
                                                <li><strong>Partage une peur :</strong> "Ce qui me terrifiait le plus, c'était..."</li>
                                                <li><strong>Montre ta vulnérabilité :</strong> "Je n'ose pas en parler souvent, mais..."</li>
                                                <li><strong>Célèbre une victoire :</strong> "Le jour où j'ai enfin compris que..."</li>
                                                <li><strong>Utilise des mots forts :</strong> frustrant, bouleversant, incroyable, choqué...</li>
                                            </ul>
                                        </div>
                                    ` : ''}
                                    ${post.aiSuggestions?.emotionFeedback ? `<p style="color: #7c3aed; font-size: 0.9em; margin: 8px 0; display: block;">🔮 ${post.aiSuggestions.emotionFeedback}</p>` : ''}
                                    ${post.aiSuggestions?.emotionSuggestion ? `
                                        <div style="background: #fdf4ff; border-radius: 8px; padding: 10px; margin-top: 8px;">
                                            <strong style="color: #a855f7;">💡 Conseil personnalisé :</strong>
                                            <p style="margin: 5px 0; color: #6b21a8;">${post.aiSuggestions.emotionSuggestion}</p>
                                        </div>
                                    ` : ''}
                                </div>

                                <div style="margin-bottom: 15px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #10b981;">
                                    <p style="margin: 0 0 8px 0; color: #1f2937; font-size: 0.95em; display: block;">
                                        <strong style="color: #059669;">🔗 Cohérence :</strong> ${post.coherence?.score || 0}/100
                                        ${post.coherence?.foundKeywords?.length ? `<span style="color: #059669; font-weight: 500;"> (trouvés: ${post.coherence.foundKeywords.join(', ')})</span>` : ''}
                                    </p>
                                    <p style="color: #6b7280; font-size: 0.9em; margin: 8px 0; display: block;">
                                        ${post.coherence?.score >= 70 ? '✅ Excellent ! Ton post renforce bien ton positionnement.' :
                                          post.coherence?.score >= 40 ? '👍 Quelques mots-clés présents, mais tu peux renforcer ton expertise.' :
                                          post.coherence?.score > 0 ? '⚠️ Peu de liens avec ton domaine. Ce post ne renforce pas ton positionnement.' :
                                          '❌ Hors sujet. Ce post ne parle pas de ton expertise.'}
                                    </p>
                                    ${post.coherence?.missingKeywords?.length ? `<p style="color: #dc2626; font-size: 0.9em; margin: 8px 0; display: block;">⚠️ Mots-clés à intégrer : <strong>${post.coherence.missingKeywords.join(', ')}</strong></p>` : ''}
                                    ${post.coherence?.score < 70 ? `
                                        <div style="background: #ecfdf5; border-radius: 8px; padding: 10px; margin-top: 8px;">
                                            <strong style="color: #059669;">💡 Conseil :</strong>
                                            <p style="margin: 5px 0; color: #065f46; font-size: 0.9em;">Intègre naturellement tes mots-clés d'expertise dans ton post. Exemple : "En tant que [ton domaine], je vois souvent..." ou "C'est ce que j'apprends à mes clients en [domaine]..."</p>
                                        </div>
                                    ` : ''}
                                    ${post.aiSuggestions?.coherenceFeedback ? `<p style="color: #059669; font-size: 0.9em; margin: 8px 0; display: block;">🔮 ${post.aiSuggestions.coherenceFeedback}</p>` : ''}
                                </div>

                                <div style="margin-bottom: 15px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #eab308;">
                                    <p style="margin: 0 0 8px 0; color: #1f2937; font-size: 0.95em; display: block;">
                                        <strong style="color: #ca8a04;">💎 Promesse :</strong> ${post.promise?.score || 0}/100
                                    </p>
                                    <p style="color: #6b7280; font-size: 0.9em; margin: 8px 0; display: block;">
                                        ${post.promise?.score >= 70 ? '✅ Le bénéfice pour le lecteur est clair !' :
                                          post.promise?.score >= 50 ? '👍 Une promesse existe mais pourrait être plus concrète.' :
                                          post.promise?.score >= 30 ? '⚠️ Promesse floue. Le lecteur ne sait pas ce qu\'il va apprendre.' :
                                          '❌ Pas de promesse. Pourquoi devrait-on lire ce post ?'}
                                    </p>
                                    ${post.promise?.score < 70 && !post.aiSuggestions?.promiseClearer ? `
                                        <div style="background: #fefce8; border-radius: 8px; padding: 10px; margin-top: 8px;">
                                            <strong style="color: #ca8a04;">💡 Comment formuler une promesse claire :</strong>
                                            <ul style="margin: 5px 0; padding-left: 20px; color: #854d0e; font-size: 0.9em;">
                                                <li>"Après avoir lu ce post, tu sauras exactement..."</li>
                                                <li>"Je vais te montrer comment [bénéfice concret]"</li>
                                                <li>"3 techniques pour [résultat mesurable]"</li>
                                                <li>"Ce qui m'a permis de [résultat] en [temps]"</li>
                                            </ul>
                                        </div>
                                    ` : ''}
                                    ${post.aiSuggestions?.promiseFeedback ? `<p style="color: #ca8a04; font-size: 0.9em; margin: 8px 0; display: block;">🔮 ${post.aiSuggestions.promiseFeedback}</p>` : ''}
                                    ${post.aiSuggestions?.promiseClearer ? `
                                        <div style="background: #fefce8; border-radius: 8px; padding: 10px; margin-top: 8px;">
                                            <strong style="color: #ca8a04;">💡 Promesse clarifiée :</strong>
                                            <p style="margin: 5px 0; color: #854d0e;">${post.aiSuggestions.promiseClearer}</p>
                                        </div>
                                    ` : ''}
                                </div>

                                ${post.hasImages ? `
                                    <div style="margin-bottom: 15px; padding: 12px; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-radius: 8px; border-left: 3px solid #0ea5e9;">
                                        <p style="margin: 0 0 8px 0; color: #1f2937; font-size: 0.95em; display: block;">
                                            <strong style="color: #0284c7;">🖼️ Analyse du visuel (${post.imageCount} image${post.imageCount > 1 ? 's' : ''}) :</strong>
                                        </p>
                                        ${post.aiSuggestions?.imageDescription ? `
                                            <div style="background: #f8fafc; border-radius: 6px; padding: 10px; margin-bottom: 10px;">
                                                <strong style="color: #475569;">👁️ Ce que l'IA voit :</strong>
                                                <p style="color: #64748b; font-size: 0.9em; margin: 5px 0 0 0;">${post.aiSuggestions.imageDescription}</p>
                                            </div>
                                        ` : ''}
                                        ${post.aiSuggestions?.imageCoherenceWithText ? `
                                            <div style="background: #f0fdf4; border-radius: 6px; padding: 10px; margin-bottom: 10px;">
                                                <strong style="color: #166534;">📝 Cohérence avec le texte :</strong>
                                                <p style="color: #15803d; font-size: 0.9em; margin: 5px 0 0 0;">${post.aiSuggestions.imageCoherenceWithText}</p>
                                            </div>
                                        ` : ''}
                                        ${post.aiSuggestions?.imageCoherenceBetweenImages && post.imageCount > 1 ? `
                                            <div style="background: #fefce8; border-radius: 6px; padding: 10px; margin-bottom: 10px;">
                                                <strong style="color: #854d0e;">🎠 Cohérence du carrousel :</strong>
                                                <p style="color: #a16207; font-size: 0.9em; margin: 5px 0 0 0;">${post.aiSuggestions.imageCoherenceBetweenImages}</p>
                                            </div>
                                        ` : ''}
                                        ${post.aiSuggestions?.imageFeedback ? `
                                            <p style="color: #0369a1; font-size: 0.9em; margin: 8px 0; display: block;"><strong>📊 Analyse globale :</strong> ${post.aiSuggestions.imageFeedback}</p>
                                            ${post.aiSuggestions.imageSuggestion ? `
                                                <p style="margin-top: 8px; color: #0c4a6e;"><strong>💡 Suggestion :</strong> ${post.aiSuggestions.imageSuggestion}</p>
                                            ` : ''}
                                        ` : `
                                            <p style="color: #64748b; font-size: 0.9em; margin: 8px 0; font-style: italic;">
                                                L'image a été analysée mais l'IA n'a pas fourni de feedback détaillé.
                                            </p>
                                        `}
                                    </div>
                                ` : ''}
                            </div>
                            <button onclick="AuditModule.rewritePost(${idx})"
                                    style="margin-top: 15px; width: 100%; padding: 12px 20px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95em; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.2s, box-shadow 0.2s;"
                                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102,126,234,0.4)'"
                                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                                ✏️ Réécrire ce post
                            </button>
                        </div>
                    `).join('')}
                </div>

                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px;">
                    <button class="audit-reset-btn" onclick="AuditModule.resetPostsAnalysis()" style="flex: 1; min-width: 150px;">
                        🔄 Analyser d'autres posts
                    </button>
                    <button class="audit-reset-btn" onclick="AuditModule.showHistory()" style="flex: 1; min-width: 150px; background: linear-gradient(135deg, #667eea, #764ba2);">
                        📋 Voir mes audits sauvegardés
                    </button>
                </div>
                <p style="text-align: center; color: #059669; font-size: 0.85em; margin-top: 10px;">
                    ✅ Audit sauvegardé automatiquement dans "Mes audits"
                </p>
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

            // Appel à l'API (worker) avec timeout de 90 secondes
            const response = await (window.fetchWithTimeout || fetch)(CONFIG.API_URL + '/audit-visual', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(auditData)
            }, 90000);

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

            // Sauvegarder dans l'historique
            saveToHistory('profile', auditResults, selectedPlatform);

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
        posts.push({ id: newId, content: '', platform: 'linkedin', images: [] });
        switchTab('posts');
    }

    function handleImageUpload(postId, input) {
        const files = Array.from(input.files);
        if (!files.length) return;

        const post = posts.find(p => p.id === postId);
        if (!post) return;

        // Initialiser le tableau images si nécessaire
        if (!post.images) post.images = [];

        // Vérifier limite
        const remainingSlots = 10 - post.images.length;
        if (remainingSlots <= 0) {
            alert('Maximum 10 images par post (carrousel)');
            return;
        }

        const filesToProcess = files.slice(0, remainingSlots);

        filesToProcess.forEach(file => {
            // Vérifier le type
            if (!file.type.startsWith('image/')) {
                console.warn('Fichier ignoré (pas une image):', file.name);
                return;
            }

            // Vérifier la taille (max 5MB par image)
            if (file.size > 5 * 1024 * 1024) {
                alert(`Image "${file.name}" trop lourde (max 5MB par image)`);
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                post.images.push({
                    data: e.target.result,
                    name: file.name.length > 15 ? file.name.substring(0, 12) + '...' : file.name
                });
                switchTab('posts');
            };
            reader.readAsDataURL(file);
        });

        // Reset input pour permettre re-sélection du même fichier
        input.value = '';
    }

    function removeImage(postId, imageIndex) {
        const post = posts.find(p => p.id === postId);
        if (post && post.images) {
            post.images.splice(imageIndex, 1);
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

    async function runPostsAnalysis() {
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

        // Afficher le loader
        const content = document.getElementById('auditContent');
        if (content) {
            content.innerHTML = `
                <div class="audit-loading" style="text-align: center; padding: 60px 20px;">
                    <div class="loading-spinner" style="width: 60px; height: 60px; border: 4px solid #e0e0e0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                    <h3 style="color: #667eea; margin-bottom: 10px;">🔮 Analyse IA en cours...</h3>
                    <p style="color: #6b7280;">L'IA analyse tes posts et génère des suggestions personnalisées</p>
                    ${validPosts.some(p => p.image) ? '<p style="color: #059669; margin-top: 10px;">🖼️ Analyse des visuels en cours...</p>' : ''}
                </div>
                <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
            `;
        }

        // Analyse locale rapide
        const analyzedPosts = validPosts.map(post => analyzePost(post.content, userKeywords));

        // 7 critères
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

        // Appeler l'API IA pour suggestions détaillées
        let aiAnalysis = null;
        try {
            // Charger le profil utilisateur
            let userProfile = {};
            try {
                const profileData = localStorage.getItem('voyageCreatifUserProfile');
                if (profileData) userProfile = JSON.parse(profileData);
            } catch (e) { console.error('Erreur chargement profil:', e); }

            const apiUrl = window.CONFIG?.API_URL || 'https://tithot-api.prospectwizard.workers.dev';

            // Debug: afficher ce qui est envoyé
            const postsToSend = validPosts.map(p => ({
                content: p.content,
                platform: p.platform,
                images: p.images?.map(img => img.data) || [],
                hasImages: (p.images?.length || 0) > 0,
                imageCount: p.images?.length || 0
            }));
            console.log('🖼️ Posts envoyés à l\'API:', postsToSend.map(p => ({
                platform: p.platform,
                hasImages: p.hasImages,
                imageCount: p.imageCount,
                contentLength: p.content?.length
            })));

            const response = await fetch(`${apiUrl}/audit-post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    posts: postsToSend,
                    keywords: userKeywords,
                    userProfile
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    aiAnalysis = result;
                    console.log('✅ Analyse IA réussie:', aiAnalysis);
                    // Debug: vérifier si l'analyse d'image est présente
                    aiAnalysis.posts?.forEach((post, idx) => {
                        if (post.analysis?.image) {
                            console.log(`🖼️ Post ${idx + 1} - Analyse image:`, post.analysis.image);
                        } else {
                            console.log(`⚠️ Post ${idx + 1} - Pas d'analyse image dans la réponse`);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Erreur appel API IA:', error);
        }

        // Fusionner les résultats locaux avec l'IA
        const detailedAnalysis = analyzedPosts.map((localAnalysis, idx) => {
            const aiPost = aiAnalysis?.posts?.find(p => p.postIndex === idx);
            const originalPost = validPosts[idx];
            const postHasImages = (originalPost?.images?.length || 0) > 0;

            console.log(`📊 Post ${idx + 1}: hasImages=${postHasImages}, aiImageAnalysis=${!!aiPost?.analysis?.image}`);

            return {
                ...localAnalysis,
                hasImages: postHasImages,
                imageCount: originalPost?.images?.length || 0,
                aiSuggestions: aiPost ? {
                    improvedHook: aiPost.analysis?.hook?.improved,
                    hookFeedback: aiPost.analysis?.hook?.feedback,
                    ctaAlternatives: aiPost.analysis?.cta?.alternatives,
                    ctaFeedback: aiPost.analysis?.cta?.feedback,
                    emotionSuggestion: aiPost.analysis?.emotion?.suggestion,
                    emotionFeedback: aiPost.analysis?.emotion?.feedback,
                    promiseClearer: aiPost.analysis?.promise?.clearer,
                    promiseFeedback: aiPost.analysis?.promise?.feedback,
                    structureSuggestion: aiPost.analysis?.structure?.suggestion,
                    coherenceFeedback: aiPost.analysis?.coherence?.feedback,
                    imageFeedback: aiPost.analysis?.image?.feedback,
                    imageSuggestion: aiPost.analysis?.image?.suggestion,
                    imageDescription: aiPost.analysis?.image?.description,
                    imageCoherenceWithText: aiPost.analysis?.image?.coherenceWithText,
                    imageCoherenceBetweenImages: aiPost.analysis?.image?.coherenceBetweenImages,
                    summary: aiPost.summary,
                    topPriority: aiPost.topPriority,
                    scores: aiPost.scores
                } : null
            };
        });

        // Recommandations - privilégier celles de l'IA
        const globalRecommendations = aiAnalysis?.globalRecommendations?.map(rec => ({
            priority: 'high',
            category: 'IA',
            message: rec
        })) || [];

        // Ajouter des recommandations locales si nécessaire
        if (globalRecommendations.length < 3) {
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
                    priority: 'medium',
                    category: 'Émotion',
                    message: 'Tes posts manquent d\'émotion. Raconte des histoires, partage ton ressenti.'
                });
            }
        }

        postsResults = {
            postCount: count,
            averageScores: avgScores,
            globalRecommendations,
            detailedAnalysis,
            aiPatterns: aiAnalysis?.patterns || null,
            hasAiAnalysis: !!aiAnalysis
        };

        // Incrémenter le compteur freemium (audit posts)
        if (window.FreemiumSystem) {
            window.FreemiumSystem.incrementAuditPosts();
        }

        // Sauvegarder dans l'historique
        saveToHistory('posts', postsResults, selectedPlatform);

        switchTab('posts');
    }

    function resetPostsAnalysis() {
        postsResults = null;
        switchTab('posts');
    }

    // Réécrire un post audité dans le générateur
    function rewritePost(postIndex) {
        // Récupérer le contenu du post
        const post = posts[postIndex];
        if (!post || !post.content) {
            console.error('Post non trouvé à l\'index', postIndex);
            return;
        }

        const postContent = post.content;
        const platform = post.platform || 'linkedin';

        // Fermer le modal d'audit
        closeModal();

        // Attendre que le modal soit fermé puis ouvrir le générateur
        setTimeout(() => {
            // Afficher le générateur en mode libre
            if (typeof showQuickPost === 'function') {
                showQuickPost();
            }

            // Passer en mode libre
            setTimeout(() => {
                if (typeof switchMode === 'function') {
                    switchMode('libre');
                }

                // Pré-remplir le champ avec le contenu du post
                const ideaInput = document.getElementById('ideaInput');
                if (ideaInput) {
                    ideaInput.value = postContent;
                    ideaInput.focus();
                    // Scroll vers le champ
                    ideaInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                // Sélectionner la plateforme si possible
                if (typeof selectPlatform === 'function' && platform) {
                    selectPlatform(platform);
                }

                // Notification
                if (typeof showToast === 'function') {
                    showToast('✏️ Post copié ! Modifie-le et régénère.');
                }
            }, 100);
        }, 350);
    }

    // ============================================================
    // VIDEO AUDIT (Gemini)
    // ============================================================

    function renderVideosTab() {
        // Barre de progression pour les gros fichiers
        const progressBar = isAnalyzing && uploadProgress > 0 && uploadProgress < 100 ? `
            <div class="upload-progress" style="margin-top: 10px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <span>📤 Upload en cours...</span>
                    <span style="font-weight: bold;">${uploadProgress}%</span>
                </div>
                <div style="background: #e0e0e0; border-radius: 10px; height: 8px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: ${uploadProgress}%; transition: width 0.3s;"></div>
                </div>
            </div>
        ` : '';

        // Info sur le mode d'upload
        const uploadModeInfo = videoData?.useFileAPI ? `
            <p class="audit-hint" style="color: #059669;">✨ Fichier volumineux : upload optimisé via Gemini File API</p>
        ` : '';

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
                     onclick="${!isCompressing ? "document.getElementById('videoInput').click()" : ''}">
                    ${videoData ? `
                        <video class="video-preview" controls>
                            <source src="${videoData.preview}" type="${videoData.mimeType}">
                        </video>
                        <div class="video-info">
                            <strong>${videoData.name}</strong> (${(videoData.size / 1024 / 1024).toFixed(1)} Mo)
                            ${!isCompressing ? `<button class="remove-btn" onclick="event.stopPropagation(); AuditModule.removeVideo()">✕ Supprimer</button>` : ''}
                        </div>
                        ${videoData.needsCompression && !isCompressing ? `
                            <div style="margin-top: 10px; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                                <p style="margin: 0 0 8px 0; color: #92400e; font-size: 0.9em;">
                                    ⚠️ <strong>Vidéo trop volumineuse</strong> (${(videoData.size / 1024 / 1024).toFixed(1)} Mo > 20 Mo max)
                                </p>
                                <p style="margin: 0; color: #78716c; font-size: 0.85em;">
                                    Clique sur "Compresser" pour réduire automatiquement la taille.
                                </p>
                            </div>
                        ` : ''}
                        ${isCompressing ? `
                            <div style="margin-top: 15px; padding: 15px; background: linear-gradient(135deg, #dbeafe, #ede9fe); border-radius: 10px;">
                                <p style="margin: 0 0 10px 0; font-weight: 600; color: #4338ca;">
                                    🔄 Compression en cours... <span class="compression-percent">${compressionProgress}%</span>
                                </p>
                                <div style="background: #e0e0e0; border-radius: 10px; height: 10px; overflow: hidden;">
                                    <div class="compression-progress-bar" style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: ${compressionProgress}%; transition: width 0.3s;"></div>
                                </div>
                                <p style="margin: 10px 0 0 0; color: #6366f1; font-size: 0.8em;">
                                    ☕ Cela peut prendre 1-2 minutes selon la taille...
                                </p>
                            </div>
                        ` : ''}
                    ` : `
                        <span style="font-size: 3em;">🎥</span>
                        <p>Clique ou glisse ta vidéo ici</p>
                        <p class="audit-hint">MP4, MOV, WebM - Max 20 Mo (compression auto disponible)</p>
                    `}
                </div>
                <input type="file" id="videoInput" accept="video/*" style="display: none;"
                       onchange="AuditModule.handleVideoUpload(this)">
                ${progressBar}
            </div>

            <div class="audit-section">
                <h3>3️⃣ Ton domaine <span class="optional-tag">optionnel</span></h3>
                <input type="text" id="videoKeywords" class="audit-input"
                       placeholder="Ex: fitness, marketing digital, cuisine..."
                       value="${userKeywords.join(', ')}"
                       onchange="AuditModule.updateKeywords(this.value)">
            </div>

            ${videoData?.needsCompression && !isCompressing ? `
                <button class="audit-run-btn" onclick="AuditModule.compressVideo()" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                    🗜️ Compresser automatiquement
                </button>
                <p class="audit-hint" style="text-align: center; margin-top: 8px;">
                    Ou <a href="https://clideo.com/compress-video" target="_blank" style="color: #667eea;">compresse manuellement</a> avec un outil externe
                </p>
            ` : isCompressing ? `
                <button class="audit-run-btn disabled" disabled>
                    <span class="loading-spinner"></span> Compression en cours...
                </button>
            ` : `
                <button class="audit-run-btn ${!videoData || isAnalyzing ? 'disabled' : ''}"
                        onclick="AuditModule.runVideoAudit()"
                        ${!videoData || isAnalyzing ? 'disabled' : ''}>
                    ${isAnalyzing ? '<span class="loading-spinner"></span> Analyse en cours...' : '🎬 Analyser ma vidéo'}
                </button>
            `}

            ${!videoData ? '<p class="audit-hint" style="text-align: center; margin-top: 10px;">Upload une vidéo pour lancer l\'analyse</p>' : ''}

            ${isAnalyzing ? `
                <div class="audit-loading-message" style="margin-top: 20px; padding: 20px; background: linear-gradient(135deg, #fef3c7, #fef9c3); border-radius: 12px; border-left: 4px solid #f59e0b; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 1.1em;">☕ <strong>L'IA analyse ta vidéo en profondeur...</strong></p>
                    <p style="margin: 0; color: #92400e; font-size: 0.9em;">
                        Cela peut prendre 1 à 3 minutes. C'est le bon moment pour aller chercher un café !
                    </p>
                </div>
            ` : `
                <div class="audit-info-feedback" style="margin-top: 15px; padding: 12px; background: linear-gradient(135deg, #e0f2fe, #f0f9ff); border-radius: 10px; border-left: 4px solid #0ea5e9;">
                    <p style="margin: 0; color: #0369a1; font-size: 0.9em;">
                        ⏱️ <strong>~1-3 min</strong> • 📄 Analyse hook, rythme, CTA + score détaillé • 💾 Sauvegardé automatiquement
                    </p>
                </div>
            `}
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

    // Limite pour base64 : 20MB max (au-delà = trop gros pour Cloudflare)
    const MAX_BASE64_SIZE = 20 * 1024 * 1024; // 20MB
    const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB max pour compression

    // État de compression
    let isCompressing = false;
    let compressionProgress = 0;
    let pendingLargeFile = null; // Fichier en attente de compression

    function handleVideoUpload(input) {
        const file = input.files[0];
        if (!file) return;

        // Vérifier le type
        if (!file.type.startsWith('video/')) {
            alert('Seules les vidéos sont acceptées');
            return;
        }

        // Vérifier la taille max absolue
        if (file.size > MAX_VIDEO_SIZE) {
            alert('Vidéo trop volumineuse (max 500 Mo)');
            return;
        }

        // Si > 20MB, proposer la compression
        if (file.size > MAX_BASE64_SIZE) {
            pendingLargeFile = file;
            videoData = {
                file: file,
                data: null,
                preview: URL.createObjectURL(file),
                name: file.name,
                size: file.size,
                mimeType: file.type,
                needsCompression: true
            };
            switchTab('videos');
            return;
        }

        // Pour les petits fichiers, lire en base64 directement
        loadVideoAsBase64(file);
    }

    function loadVideoAsBase64(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            videoData = {
                file: null,
                data: e.target.result,
                preview: URL.createObjectURL(file),
                name: file.name,
                size: file.size,
                mimeType: file.type,
                needsCompression: false
            };
            switchTab('videos');
        };
        reader.readAsDataURL(file);
    }

    // Compression avec FFmpeg.wasm
    async function compressVideo() {
        if (!pendingLargeFile) return;

        isCompressing = true;
        compressionProgress = 0;
        switchTab('videos');

        try {
            // Vérifier si SharedArrayBuffer est disponible (requis pour FFmpeg.wasm)
            if (typeof SharedArrayBuffer === 'undefined') {
                console.error('[Compression] SharedArrayBuffer non disponible. Headers COOP/COEP manquants.');
                throw new Error('SharedArrayBuffer non disponible. La compression dans le navigateur nécessite des headers spéciaux. Utilise un outil externe.');
            }
            console.log('[Compression] SharedArrayBuffer disponible ✓');

            // Charger FFmpeg.wasm dynamiquement
            if (!window.FFmpeg) {
                compressionProgress = 5;
                switchTab('videos');
                console.log('[Compression] Chargement des scripts FFmpeg...');

                // Charger le script FFmpeg
                await loadScript('https://unpkg.com/@ffmpeg/ffmpeg@0.12.7/dist/umd/ffmpeg.js');
                await loadScript('https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js');
                console.log('[Compression] Scripts FFmpeg chargés ✓');
            }

            compressionProgress = 10;
            switchTab('videos');

            const { FFmpeg } = window.FFmpegWASM || window;
            const { fetchFile } = window.FFmpegUtil || window;

            const ffmpeg = new FFmpeg();

            ffmpeg.on('progress', ({ progress }) => {
                compressionProgress = 10 + Math.round(progress * 80); // 10-90%
                updateCompressionUI();
            });

            compressionProgress = 15;
            updateCompressionUI();

            // Charger FFmpeg core
            await ffmpeg.load({
                coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
                wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
            });

            compressionProgress = 20;
            updateCompressionUI();

            // Écrire le fichier en mémoire
            const inputName = 'input' + getFileExtension(pendingLargeFile.name);
            await ffmpeg.writeFile(inputName, await fetchFile(pendingLargeFile));

            compressionProgress = 30;
            updateCompressionUI();

            // Compresser agressivement pour vidéos longues (1-2 min)
            // CRF 32 = compression forte, 720p max, audio 96k
            await ffmpeg.exec([
                '-i', inputName,
                '-c:v', 'libx264',
                '-crf', '32',
                '-preset', 'fast',
                '-vf', 'scale=-2:720',  // Max 720p (suffisant pour analyse IA)
                '-c:a', 'aac',
                '-b:a', '96k',
                '-movflags', '+faststart',
                '-y',
                'output.mp4'
            ]);

            compressionProgress = 90;
            updateCompressionUI();

            // Lire le résultat
            const data = await ffmpeg.readFile('output.mp4');
            const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });
            const compressedFile = new File([compressedBlob], 'compressed_' + pendingLargeFile.name.replace(/\.[^.]+$/, '.mp4'), { type: 'video/mp4' });

            compressionProgress = 95;
            updateCompressionUI();

            // Nettoyer
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile('output.mp4');

            // Charger la vidéo compressée
            const originalSize = pendingLargeFile.size;
            pendingLargeFile = null;

            if (compressedFile.size > MAX_BASE64_SIZE) {
                alert(`La vidéo compressée fait encore ${(compressedFile.size / 1024 / 1024).toFixed(1)} Mo (max 20 Mo).\n\n💡 Solutions :\n• Coupe les parties inutiles de ta vidéo\n• Utilise clideo.com/compress-video pour plus de contrôle\n• Pour les vidéos très longues (>3 min), divise-les en plusieurs parties`);
                isCompressing = false;
                switchTab('videos');
                return;
            }

            // Succès ! Charger en base64
            loadVideoAsBase64(compressedFile);

            const newSize = compressedFile.size;
            const reduction = Math.round((1 - newSize / originalSize) * 100);
            console.log(`[Compression] ${(originalSize/1024/1024).toFixed(1)} Mo → ${(newSize/1024/1024).toFixed(1)} Mo (-${reduction}%)`);

        } catch (error) {
            console.error('[Compression] Erreur:', error);
            console.error('[Compression] Message:', error.message);
            console.error('[Compression] Stack:', error.stack);

            let errorMsg = 'Erreur lors de la compression.\n\n';
            if (error.message?.includes('SharedArrayBuffer')) {
                errorMsg += '⚠️ Ton navigateur ne supporte pas la compression dans le navigateur.\n\n';
            } else {
                errorMsg += `Détail: ${error.message || 'Erreur inconnue'}\n\n`;
            }
            errorMsg += '💡 Solutions :\n';
            errorMsg += '1. Compresse ta vidéo avec clideo.com/compress-video\n';
            errorMsg += '2. Ou utilise HandBrake (gratuit) pour compresser\n';
            errorMsg += '3. Ou réduis la durée de ta vidéo (< 1 min idéalement)';

            alert(errorMsg);
        }

        isCompressing = false;
        compressionProgress = 0;
        switchTab('videos');
    }

    function updateCompressionUI() {
        const progressEl = document.querySelector('.compression-progress-bar');
        if (progressEl) {
            progressEl.style.width = compressionProgress + '%';
        }
        const percentEl = document.querySelector('.compression-percent');
        if (percentEl) {
            percentEl.textContent = compressionProgress + '%';
        }
    }

    function getFileExtension(filename) {
        return filename.slice(filename.lastIndexOf('.')).toLowerCase() || '.mp4';
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function cancelCompression() {
        pendingLargeFile = null;
        videoData = null;
        isCompressing = false;
        compressionProgress = 0;
        switchTab('videos');
    }

    function removeVideo() {
        if (videoData?.preview) {
            URL.revokeObjectURL(videoData.preview);
        }
        videoData = null;
        pendingLargeFile = null;
        isCompressing = false;
        compressionProgress = 0;
        switchTab('videos');
    }

    // Variable pour stocker la progression de l'upload
    let uploadProgress = 0;

    /**
     * Met à jour uniquement l'UI de progression sans re-rendre toute la page
     */
    function updateUploadProgressUI(percent) {
        uploadProgress = percent;

        // Mettre à jour le texte du bouton
        const runBtn = document.querySelector('.audit-run-btn');
        if (runBtn) {
            if (percent > 0 && percent < 100) {
                runBtn.innerHTML = `<span class="loading-spinner"></span> Upload ${percent}%...`;
            } else if (percent >= 100) {
                runBtn.innerHTML = `<span class="loading-spinner"></span> Analyse en cours...`;
            }
        }

        // Mettre à jour ou créer la barre de progression
        let progressContainer = document.querySelector('.upload-progress');
        if (percent > 0 && percent < 100) {
            if (!progressContainer) {
                // Créer la barre de progression si elle n'existe pas
                const videoSection = document.querySelector('.video-upload-zone')?.parentElement;
                if (videoSection) {
                    progressContainer = document.createElement('div');
                    progressContainer.className = 'upload-progress';
                    progressContainer.style.marginTop = '10px';
                    videoSection.appendChild(progressContainer);
                }
            }
            if (progressContainer) {
                progressContainer.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                        <span>📤 Upload en cours...</span>
                        <span style="font-weight: bold;">${percent}%</span>
                    </div>
                    <div style="background: #e0e0e0; border-radius: 10px; height: 8px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: ${percent}%; transition: width 0.3s;"></div>
                    </div>
                `;
            }
        } else if (progressContainer && percent >= 100) {
            // Upload terminé, changer le message
            progressContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span>✅ Upload terminé, analyse en cours...</span>
                </div>
            `;
        }
    }

    /**
     * Upload une vidéo vers Gemini File API avec progression
     * @returns {Promise<string>} fileUri pour l'analyse
     */
    async function uploadVideoToGemini(file, onProgress) {
        // Étape 1: Initier l'upload via le Worker
        const initResponse = await fetch(CONFIG.API_URL + '/api/video-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mimeType: file.type,
                displayName: file.name,
                sizeBytes: file.size
            })
        });

        if (!initResponse.ok) {
            const error = await initResponse.json();
            throw new Error(error.error || 'Erreur initialisation upload');
        }

        const { uploadUrl } = await initResponse.json();

        // Étape 2: Upload direct vers Gemini avec progression
        const uploadResult = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch {
                        resolve({ raw: xhr.responseText });
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));

            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.setRequestHeader('X-Goog-Upload-Offset', '0');
            xhr.setRequestHeader('X-Goog-Upload-Command', 'upload, finalize');
            xhr.send(file);
        });

        // Extraire le fileName de la réponse
        const fileName = uploadResult.file?.name || uploadResult.name;
        if (!fileName) {
            throw new Error('No file name returned from upload');
        }

        // Étape 3: Vérifier que le fichier est prêt
        onProgress && onProgress(100);
        const completeResponse = await fetch(CONFIG.API_URL + '/api/video-upload-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName })
        });

        if (!completeResponse.ok) {
            const error = await completeResponse.json();
            throw new Error(error.error || 'Erreur vérification fichier');
        }

        const fileInfo = await completeResponse.json();
        return fileInfo.uri;
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
        uploadProgress = 0;
        switchTab('videos');

        try {
            let analysisPayload;

            console.log('[VideoAudit] videoData:', {
                useFileAPI: videoData.useFileAPI,
                hasFile: !!videoData.file,
                hasData: !!videoData.data,
                dataLength: videoData.data?.length || 0,
                mimeType: videoData.mimeType,
                size: videoData.size
            });

            // Envoi en base64 (vidéos < 20MB uniquement)
            analysisPayload = {
                platform: videoPlatform,
                videoData: videoData.data,
                videoMimeType: videoData.mimeType,
                keywords: userKeywords
            };

            // Lancer l'analyse (timeout 5 min)
            console.log('[VideoAudit] Sending request to API...', {
                url: CONFIG.API_URL + '/audit-video',
                payloadSize: JSON.stringify(analysisPayload).length,
                platform: analysisPayload.platform
            });

            const response = await (window.fetchWithTimeout || fetch)(CONFIG.API_URL + '/audit-video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(analysisPayload)
            }, 300000);

            console.log('[VideoAudit] Response received:', response.status);

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

            // Sauvegarder dans l'historique
            saveToHistory('video', videoResults, videoPlatform);

        } catch (error) {
            console.error('Erreur audit vidéo:', error);
            let errorMessage = error.message || 'Erreur inconnue';

            // Messages d'erreur plus clairs
            if (error.name === 'AbortError' || errorMessage.includes('trop de temps')) {
                errorMessage = 'L\'analyse a pris trop de temps. Réessaie ou utilise la compression automatique si ta vidéo est volumineuse.';
            } else if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
                errorMessage = 'Erreur de connexion. Vérifie ta connexion internet et réessaie.';
            } else if (errorMessage.includes('413') || errorMessage.includes('too large')) {
                errorMessage = 'Vidéo trop volumineuse. Compresse-la avec un outil comme handbrake.fr ou clideo.com/compress-video';
            }

            videoResults = {
                error: true,
                message: errorMessage
            };
        }

        isAnalyzing = false;
        uploadProgress = 0;
        switchTab('videos');
    }

    function resetVideoAudit() {
        videoResults = null;
        switchTab('videos');
    }

    function getUploadProgress() {
        return uploadProgress;
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    return {
        openAuditModal,
        closeModal,
        handleOverlayMouseDown,
        handleOverlayMouseUp,
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
        rewritePost,
        // Video audit
        selectVideoPlatform,
        handleVideoUpload,
        removeVideo,
        compressVideo,
        cancelCompression,
        runVideoAudit,
        resetVideoAudit,
        getUploadProgress,
        // Historique
        showHistory,
        hideHistory,
        loadFromHistory,
        deleteFromHistory
    };

})();

// Expose globally
window.AuditModule = AuditModule;
