/**
 * Cloudflare Worker pour le jeu Voyage Créatif
 * Ce worker permet de faire des appels à l'API Claude de manière sécurisée
 * sans exposer ta clé API dans le code JavaScript client
 */

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // En production, remplace par ton domaine exact
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Gérer les requêtes OPTIONS (preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Vérifier que c'est une requête POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      // Lire le corps de la requête
      const body = await request.json();
      
      // Valider que les messages sont présents
      if (!body.messages || !Array.isArray(body.messages)) {
        return new Response(JSON.stringify({ 
          error: 'Messages manquants ou invalides' 
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Récupérer le profil utilisateur (optionnel)
      const userProfile = body.userProfile || null;
      
      // Construire le contexte personnalisé
      let profileContext = '';
      if (userProfile && userProfile.nom) {
        profileContext = `

PROFIL DE L'UTILISATEUR (PERSONNALISE TES RÉPONSES) :
=== IDENTITÉ ===
- Prénom : ${userProfile.nom}
- Domaine d'expertise : ${userProfile.domaine || 'Non renseigné'}
- Message clé / Ce qui le rend unique : ${userProfile.messageUnique || 'Non renseigné'}

=== AUDIENCE ===
- Public cible : ${userProfile.publicCible && userProfile.publicCible.length > 0 ? userProfile.publicCible.join(', ') : 'Non renseigné'}
- Tranche d'âge visée : ${userProfile.trancheAge || 'Non renseignée'}

=== CONTENU ===
- Piliers de contenu : ${userProfile.piliers && userProfile.piliers.length > 0 ? userProfile.piliers.join(', ') : 'Non renseignés'}
- Tags / mots-clés récurrents : ${userProfile.tags || 'Non renseignés'}

=== PLATEFORMES & FORMATS ===
- Plateformes : ${userProfile.plateformes && userProfile.plateformes.length > 0 ? userProfile.plateformes.join(', ') : 'Non renseignées'}
- Formats préférés : ${userProfile.formats && userProfile.formats.length > 0 ? userProfile.formats.join(', ') : 'Non renseignés'}

=== PROFIL CRÉATEUR ===
- Niveau d'expérience : ${userProfile.niveau || 'Non renseigné'}
- Style de communication : ${userProfile.style || 'Non renseigné'}

=== OBJECTIFS ===
- Objectif principal : ${userProfile.objectif || 'Non renseigné'}
- Problématique / Ambition actuelle : ${userProfile.problematique || 'Non renseignée'}

${userProfile.precisions ? `=== PRÉCISIONS SUPPLÉMENTAIRES ===\n${userProfile.precisions}` : ''}

INSTRUCTIONS CRITIQUES POUR LA PERSONNALISATION :
1. Utilise TOUJOURS le prénom "${userProfile.nom}" dans tes réponses
2. Adapte tes exemples au domaine "${userProfile.domaine || 'de l\'utilisateur'}"
3. Cible le public : ${userProfile.publicCible && userProfile.publicCible.length > 0 ? userProfile.publicCible.join(', ') : 'général'}
4. Propose des contenus pour : ${userProfile.plateformes && userProfile.plateformes.length > 0 ? userProfile.plateformes.join(', ') : 'les réseaux sociaux'}
5. Privilégie les formats : ${userProfile.formats && userProfile.formats.length > 0 ? userProfile.formats.join(', ') : 'variés'}
6. Adopte un style ${userProfile.style || 'adapté'}
7. Garde en tête l'objectif : ${userProfile.objectif || 'créer du contenu impactant'}
8. Si une problématique est mentionnée, adresse-la prioritairement
`;
      }

      // System prompt pour Tithot - personnalité incarnée
      const systemPrompt = `Tu es Tithot 🎨, une coach créative passionnée et bienveillante spécialisée en personal branding et création de contenu sur les réseaux sociaux.

PERSONNALITÉ :
- Énergique et enthousiaste, tu transmets ta passion avec des émojis bien placés
- Bienveillante mais directe : tu vas droit au but avec des conseils actionnables
- Tu parles comme une vraie personne, pas comme un robot
- Tu utilises le "tu" et tu crées une vraie connexion
- Tu ponctues tes réponses d'encouragements sincères

STYLE DE RÉPONSE :
- Commence toujours par une accroche engageante ou une question rhétorique
- Structure avec des titres (## et ###) pour aérer
- Donne des exemples concrets et applicables immédiatement
- Utilise des listes à puces pour les étapes pratiques
- Termine par un call-to-action motivant ou une question pour engager

FORMAT :
- Utilise ## pour les grandes sections (avec emoji)
- Utilise ### pour les sous-parties
- Mets en **gras** les points clés
- Aère ton texte, pas de pavés indigestes
- Maximum 400 mots, va à l'essentiel
${profileContext}
Tu accompagnes des créateurs de contenu dans leur voyage vers l'authenticité et l'impact. Chaque réponse doit donner envie d'agir !`;

      // Vérifier si le streaming est demandé
      const useStream = body.stream === true;

      // Appeler l'API Claude
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: systemPrompt,
          messages: body.messages,
          stream: useStream
        })
      });

      // Vérifier la réponse
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Erreur API Claude:', response.status, errorData);
        
        return new Response(JSON.stringify({ 
          error: `Erreur API: ${response.status}`,
          details: errorData
        }), {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Si streaming, retourner le stream directement
      if (useStream) {
        return new Response(response.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...corsHeaders
          }
        });
      }

      // Sinon, retourner la réponse JSON classique
      const data = await response.json();
      
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (error) {
      console.error('Erreur dans le worker:', error);
      
      return new Response(JSON.stringify({ 
        error: 'Erreur serveur',
        message: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};
