// cloudflare-worker-v3.js - Avec support Perplexity corrigé
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      const body = await request.json();

      if (!body.messages || !Array.isArray(body.messages)) {
        return new Response(JSON.stringify({
          error: "Messages manquants ou invalides"
        }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // Détecter si on doit utiliser Perplexity (pour TRENDS, Planning, recherche web)
      const usePerplexity = body.usePerplexity === true;
      
      const userProfile = body.userProfile || null;
      let profileContext = "";
      let voiceContext = "";

      if (userProfile && userProfile.nom) {
        profileContext = `

PROFIL DE L'UTILISATEUR :
- Prénom : ${userProfile.nom}
- Domaine : ${userProfile.domaine || "Non renseigné"}
- Piliers de contenu : ${userProfile.piliers && userProfile.piliers.length > 0 ? userProfile.piliers.join(", ") : "Non renseignés"}
- Style : ${userProfile.style || "Non renseigné"}
- Plateformes : ${userProfile.plateformes && userProfile.plateformes.length > 0 ? userProfile.plateformes.join(", ") : "Non renseignées"}
- Objectif : ${userProfile.objectif || "Non renseigné"}
`;

        // Ajouter le profil de voix si disponible
        if (userProfile.voiceProfile) {
          const vp = userProfile.voiceProfile;
          voiceContext = `

=== PROFIL DE VOIX DE L'UTILISATEUR (TRÈS IMPORTANT) ===
L'utilisateur a un style d'écriture unique que tu DOIS reproduire :

- Ton général : ${vp.ton || "Non défini"}
- Longueur des phrases : ${vp.longueurPhrases || "Non définie"}
- Expressions récurrentes : ${vp.expressions || "Non définies"}
- Ponctuation & émojis : ${vp.ponctuation || "Non définie"}
- Style narratif : ${vp.styleNarratif || "Non défini"}
- Vocabulaire : ${vp.vocabulaire || "Non défini"}
- Signature unique : ${vp.signature || "Non définie"}

CONSEILS POUR REPRODUIRE CETTE VOIX :
${vp.conseils || "Adopter un style naturel et authentique"}

⚠️ INSTRUCTION CRITIQUE : Tu DOIS écrire EXACTEMENT comme cette personne écrirait. 
Imite son ton, ses expressions, sa ponctuation. Le contenu doit "sonner" comme si l'utilisateur l'avait écrit lui-même.
`;
          profileContext += voiceContext;
        }
      }

      // ==================== PERPLEXITY (TRENDS, Planning, Recherche) ====================
      if (usePerplexity) {
        if (!env.PERPLEXITY_API_KEY) {
          return new Response(JSON.stringify({
            error: "Clé API Perplexity non configurée"
          }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const perplexitySystemPrompt = `Tu es Tithot, une experte en tendances réseaux sociaux et stratégie de contenu.

MISSION : Tu analyses les VRAIES tendances actuelles du web pour proposer des idées de contenu pertinentes et à jour.

${profileContext}

STYLE DE RÉPONSE :
- Utilise des données récentes et des sources fiables
- Propose des angles originaux basés sur l'actualité
- Adapte tes suggestions au profil de l'utilisateur
- Sois concise et actionnable
- Utilise des émojis pour structurer

FORMAT : Réponds TOUJOURS en JSON valide quand demandé.`;

        try {
          const response = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${env.PERPLEXITY_API_KEY}`
            },
            body: JSON.stringify({
              model: "llama-3.1-sonar-small-128k-online",
              messages: [
                { role: "system", content: perplexitySystemPrompt },
                ...body.messages
              ],
              max_tokens: 2000,
              temperature: 0.7
            })
          });

          if (!response.ok) {
            const errorData = await response.text();
            console.error("Erreur API Perplexity:", response.status, errorData);
            
            // Fallback vers Claude si Perplexity échoue
            console.log("Fallback vers Claude...");
          } else {
            const data = await response.json();
            
            // Adapter le format de réponse pour être compatible avec le frontend
            const adaptedResponse = {
              content: [{
                text: data.choices?.[0]?.message?.content || "Pas de réponse"
              }],
              citations: data.citations || [],
              model: "perplexity"
            };

            return new Response(JSON.stringify(adaptedResponse), {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }
        } catch (perplexityError) {
          console.error("Erreur Perplexity, fallback vers Claude:", perplexityError);
          // Continue vers Claude en cas d'erreur
        }
      }

      // ==================== CLAUDE (Génération de contenu ou fallback) ====================
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

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: systemPrompt,
          messages: body.messages
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Erreur API Claude:", response.status, errorData);
        return new Response(JSON.stringify({
          error: `Erreur API: ${response.status}`,
          details: errorData
        }), {
          status: response.status,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });

    } catch (error) {
      console.error("Erreur dans le worker:", error);
      return new Response(JSON.stringify({
        error: "Erreur serveur",
        message: error.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};
