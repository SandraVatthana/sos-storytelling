# SOS Storytelling - API Documentation

**Version:** 1.0
**Base URL:** `https://votre-worker.workers.dev/api/v1`

---

## 🔐 Authentification

Toutes les requêtes API nécessitent une clé API valide.

### Header d'authentification

```
Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxx
```

### Types de clés

| Préfixe | Environnement | Usage |
|---------|---------------|-------|
| `sk_live_` | Production | Requêtes facturées |
| `sk_test_` | Test | Requêtes de développement |

### Exemple

```bash
curl -X POST https://votre-worker.workers.dev/api/v1/generate \
  -H "Authorization: Bearer sk_live_votre_cle_api" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Mon sujet"}'
```

---

## 📊 Rate Limiting

Les limites de requêtes sont appliquées mensuellement selon votre plan.

### Headers de réponse

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Limite mensuelle totale |
| `X-RateLimit-Remaining` | Requêtes restantes ce mois |
| `X-RateLimit-Reset` | Timestamp de réinitialisation (1er du mois suivant) |

### Exemple de réponse headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1704067200
```

### Dépassement de limite

Si vous dépassez votre limite, vous recevrez :

```json
{
  "error": "Rate limit exceeded",
  "limit": 1000,
  "used": 1000,
  "resetAt": "2024-02-01T00:00:00.000Z"
}
```

**Status:** `429 Too Many Requests`

---

## 📚 Endpoints

### POST /generate

Génère du contenu personnalisé avec votre voix de marque.

#### Request

```json
{
  "prompt": "Comment j'ai transformé mon échec en opportunité",
  "voiceId": "uuid-du-profil-voix",
  "structure": "storytelling",
  "platform": "linkedin",
  "options": {
    "includeHook": true,
    "includeCTA": true,
    "maxLength": 1500
  }
}
```

#### Paramètres

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `prompt` | string | ✅ | Le sujet ou thème du contenu |
| `voiceId` | string | ❌ | UUID du profil de voix (défaut: profil par défaut) |
| `structure` | string | ❌ | Structure narrative (voir `/structures`) |
| `platform` | string | ❌ | Plateforme cible (voir `/platforms`) |
| `options` | object | ❌ | Options de génération |

#### Options disponibles

| Option | Type | Défaut | Description |
|--------|------|--------|-------------|
| `includeHook` | boolean | true | Inclure une accroche percutante |
| `includeCTA` | boolean | true | Inclure un appel à l'action |
| `maxLength` | number | 1500 | Longueur maximale en caractères |
| `tone` | string | null | Surcharge temporaire du ton |
| `language` | string | "fr" | Langue du contenu (fr, en) |

#### Response (200 OK)

```json
{
  "success": true,
  "content": "🎯 Il y a 3 ans, j'ai tout perdu...\n\nMon entreprise, mes économies, ma confiance.\n\nMais cette chute m'a appris quelque chose d'essentiel :\n\n→ L'échec n'est pas une fin, c'est un pivot.\n→ Chaque erreur contient une leçon cachée.\n→ La résilience se construit dans l'adversité.\n\nAujourd'hui, je gère une équipe de 15 personnes.\n\nEt toi, quelle est ta plus grande leçon tirée d'un échec ?\n\n#Entrepreneuriat #Résilience #Leadership",
  "metadata": {
    "structure": "storytelling",
    "platform": "linkedin",
    "voiceId": "uuid-du-profil",
    "tokensUsed": {
      "input": 245,
      "output": 180
    },
    "generatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Erreurs possibles

| Status | Code | Description |
|--------|------|-------------|
| 400 | `MISSING_PROMPT` | Le paramètre prompt est requis |
| 400 | `INVALID_STRUCTURE` | Structure non reconnue |
| 400 | `INVALID_PLATFORM` | Plateforme non supportée |
| 404 | `VOICE_NOT_FOUND` | Profil de voix introuvable |
| 429 | `RATE_LIMIT_EXCEEDED` | Limite mensuelle atteinte |
| 500 | `GENERATION_FAILED` | Erreur lors de la génération |

---

### GET /voices

Liste tous vos profils de voix.

#### Request

```bash
curl https://votre-worker.workers.dev/api/v1/voices \
  -H "Authorization: Bearer sk_live_votre_cle_api"
```

#### Response (200 OK)

```json
{
  "success": true,
  "voices": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Voix LinkedIn Pro",
      "isDefault": true,
      "createdAt": "2024-01-10T08:00:00.000Z",
      "updatedAt": "2024-01-12T14:30:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Voix Instagram Casual",
      "isDefault": false,
      "createdAt": "2024-01-11T09:00:00.000Z",
      "updatedAt": "2024-01-11T09:00:00.000Z"
    }
  ],
  "count": 2
}
```

---

### GET /voices/:id

Récupère les détails d'un profil de voix spécifique.

#### Request

```bash
curl https://votre-worker.workers.dev/api/v1/voices/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer sk_live_votre_cle_api"
```

#### Response (200 OK)

```json
{
  "success": true,
  "voice": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Voix LinkedIn Pro",
    "isDefault": true,
    "profileData": {
      "ton": "Professionnel mais accessible, avec une touche d'humour",
      "longueurPhrases": "Phrases courtes et percutantes. Paragraphes aérés.",
      "expressions": ["C'est là que tout a basculé", "Et vous savez quoi ?", "La vérité c'est que"],
      "ponctuation": "Points de suspension pour le suspense... Émojis stratégiques 🎯",
      "styleNarratif": "Storytelling personnel avec leçons universelles",
      "vocabulaire": ["transformer", "déclic", "game-changer", "mindset"],
      "signature": "Une question ouverte pour engager",
      "conseils": "Toujours commencer par une accroche forte"
    },
    "createdAt": "2024-01-10T08:00:00.000Z",
    "updatedAt": "2024-01-12T14:30:00.000Z"
  }
}
```

#### Erreurs possibles

| Status | Code | Description |
|--------|------|-------------|
| 404 | `VOICE_NOT_FOUND` | Profil de voix introuvable |

---

### GET /usage

Récupère vos statistiques d'utilisation.

#### Query Parameters

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `period` | string | "month" | Période: "day", "week", "month", "year" |
| `startDate` | string | - | Date de début (ISO 8601) |
| `endDate` | string | - | Date de fin (ISO 8601) |

#### Request

```bash
# Usage du mois en cours
curl "https://votre-worker.workers.dev/api/v1/usage" \
  -H "Authorization: Bearer sk_live_votre_cle_api"

# Usage sur période personnalisée
curl "https://votre-worker.workers.dev/api/v1/usage?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer sk_live_votre_cle_api"
```

#### Response (200 OK)

```json
{
  "success": true,
  "usage": {
    "period": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-01-31T23:59:59.000Z"
    },
    "summary": {
      "totalRequests": 153,
      "successfulRequests": 148,
      "failedRequests": 5,
      "totalTokens": 45230,
      "tokensInput": 18450,
      "tokensOutput": 26780,
      "avgLatencyMs": 2340
    },
    "byEndpoint": {
      "/generate": {
        "requests": 150,
        "tokens": 44500
      },
      "/voices": {
        "requests": 3,
        "tokens": 730
      }
    },
    "byDay": [
      {
        "date": "2024-01-15",
        "requests": 12,
        "tokens": 3500
      },
      {
        "date": "2024-01-16",
        "requests": 8,
        "tokens": 2200
      }
    ],
    "limits": {
      "monthly": 1000,
      "used": 153,
      "remaining": 847,
      "resetAt": "2024-02-01T00:00:00.000Z"
    }
  }
}
```

---

### GET /structures

Liste les structures narratives disponibles.

#### Request

```bash
curl https://votre-worker.workers.dev/api/v1/structures \
  -H "Authorization: Bearer sk_live_votre_cle_api"
```

#### Response (200 OK)

```json
{
  "success": true,
  "structures": [
    {
      "id": "storytelling",
      "name": "Storytelling",
      "description": "Histoire personnelle avec arc narratif complet",
      "bestFor": ["linkedin", "blog"]
    },
    {
      "id": "aida",
      "name": "AIDA",
      "description": "Attention, Intérêt, Désir, Action",
      "bestFor": ["linkedin", "email"]
    },
    {
      "id": "pas",
      "name": "PAS",
      "description": "Problème, Agitation, Solution",
      "bestFor": ["linkedin", "landing"]
    },
    {
      "id": "hook-story-offer",
      "name": "Hook-Story-Offer",
      "description": "Accroche, Histoire, Offre",
      "bestFor": ["instagram", "tiktok"]
    },
    {
      "id": "listicle",
      "name": "Listicle",
      "description": "Liste de points ou conseils numérotés",
      "bestFor": ["twitter", "linkedin"]
    },
    {
      "id": "contrarian",
      "name": "Opinion Contrarian",
      "description": "Point de vue qui challenge les idées reçues",
      "bestFor": ["linkedin", "twitter"]
    }
  ]
}
```

---

### GET /platforms

Liste les plateformes supportées avec leurs contraintes.

#### Request

```bash
curl https://votre-worker.workers.dev/api/v1/platforms \
  -H "Authorization: Bearer sk_live_votre_cle_api"
```

#### Response (200 OK)

```json
{
  "success": true,
  "platforms": [
    {
      "id": "linkedin",
      "name": "LinkedIn",
      "maxLength": 3000,
      "features": ["hashtags", "emojis", "mentions"],
      "tone": "professional"
    },
    {
      "id": "twitter",
      "name": "Twitter/X",
      "maxLength": 280,
      "features": ["hashtags", "threads"],
      "tone": "concise"
    },
    {
      "id": "instagram",
      "name": "Instagram",
      "maxLength": 2200,
      "features": ["hashtags", "emojis", "line-breaks"],
      "tone": "casual"
    },
    {
      "id": "tiktok",
      "name": "TikTok",
      "maxLength": 2200,
      "features": ["hashtags", "hooks"],
      "tone": "dynamic"
    },
    {
      "id": "newsletter",
      "name": "Newsletter",
      "maxLength": null,
      "features": ["sections", "cta"],
      "tone": "personal"
    },
    {
      "id": "blog",
      "name": "Blog",
      "maxLength": null,
      "features": ["headings", "seo"],
      "tone": "informative"
    }
  ]
}
```

---

## ⚠️ Codes d'erreur

### Format standard des erreurs

```json
{
  "error": "Description de l'erreur",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Liste des codes

| Code HTTP | Code erreur | Description |
|-----------|-------------|-------------|
| 400 | `BAD_REQUEST` | Requête malformée |
| 400 | `MISSING_PROMPT` | Prompt requis mais absent |
| 400 | `INVALID_STRUCTURE` | Structure non reconnue |
| 400 | `INVALID_PLATFORM` | Plateforme non supportée |
| 401 | `UNAUTHORIZED` | Clé API manquante |
| 401 | `INVALID_API_KEY` | Clé API invalide ou révoquée |
| 403 | `FORBIDDEN` | Permission insuffisante |
| 404 | `NOT_FOUND` | Ressource introuvable |
| 404 | `VOICE_NOT_FOUND` | Profil de voix introuvable |
| 429 | `RATE_LIMIT_EXCEEDED` | Limite mensuelle dépassée |
| 500 | `INTERNAL_ERROR` | Erreur serveur interne |
| 500 | `GENERATION_FAILED` | Échec de génération Claude |
| 503 | `SERVICE_UNAVAILABLE` | Service temporairement indisponible |

---

## 💻 Exemples de code

### JavaScript / Node.js

```javascript
const SOS_API_KEY = 'sk_live_votre_cle_api';
const BASE_URL = 'https://votre-worker.workers.dev/api/v1';

async function generateContent(prompt, options = {}) {
  const response = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SOS_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      structure: options.structure || 'storytelling',
      platform: options.platform || 'linkedin',
      voiceId: options.voiceId,
      options: {
        includeHook: true,
        includeCTA: true,
        maxLength: options.maxLength || 1500
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API Error');
  }

  return response.json();
}

// Usage
const result = await generateContent(
  "Comment j'ai doublé mon CA en 6 mois",
  { structure: 'storytelling', platform: 'linkedin' }
);
console.log(result.content);
```

### Python

```python
import requests

SOS_API_KEY = 'sk_live_votre_cle_api'
BASE_URL = 'https://votre-worker.workers.dev/api/v1'

def generate_content(prompt, structure='storytelling', platform='linkedin', voice_id=None):
    headers = {
        'Authorization': f'Bearer {SOS_API_KEY}',
        'Content-Type': 'application/json'
    }

    payload = {
        'prompt': prompt,
        'structure': structure,
        'platform': platform,
        'options': {
            'includeHook': True,
            'includeCTA': True,
            'maxLength': 1500
        }
    }

    if voice_id:
        payload['voiceId'] = voice_id

    response = requests.post(
        f'{BASE_URL}/generate',
        headers=headers,
        json=payload
    )

    response.raise_for_status()
    return response.json()

# Usage
result = generate_content(
    "Les 3 erreurs qui tuent votre personal branding",
    structure='listicle',
    platform='linkedin'
)
print(result['content'])
```

### cURL

```bash
# Générer du contenu
curl -X POST "https://votre-worker.workers.dev/api/v1/generate" \
  -H "Authorization: Bearer sk_live_votre_cle_api" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Mon parcours d entrepreneur",
    "structure": "storytelling",
    "platform": "linkedin"
  }'

# Lister les profils de voix
curl "https://votre-worker.workers.dev/api/v1/voices" \
  -H "Authorization: Bearer sk_live_votre_cle_api"

# Voir l usage
curl "https://votre-worker.workers.dev/api/v1/usage" \
  -H "Authorization: Bearer sk_live_votre_cle_api"
```

### PHP

```php
<?php
$apiKey = 'sk_live_votre_cle_api';
$baseUrl = 'https://votre-worker.workers.dev/api/v1';

function generateContent($prompt, $options = []) {
    global $apiKey, $baseUrl;

    $payload = [
        'prompt' => $prompt,
        'structure' => $options['structure'] ?? 'storytelling',
        'platform' => $options['platform'] ?? 'linkedin',
        'options' => [
            'includeHook' => true,
            'includeCTA' => true,
            'maxLength' => $options['maxLength'] ?? 1500
        ]
    ];

    if (isset($options['voiceId'])) {
        $payload['voiceId'] = $options['voiceId'];
    }

    $ch = curl_init("$baseUrl/generate");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $apiKey",
            "Content-Type: application/json"
        ],
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("API Error: $response");
    }

    return json_decode($response, true);
}

// Usage
$result = generateContent(
    "Pourquoi j'ai quitté mon CDI",
    ['structure' => 'hook-story-offer', 'platform' => 'instagram']
);
echo $result['content'];
```

---

## 🔧 Bonnes pratiques

### 1. Gestion des erreurs

Toujours implémenter une gestion robuste des erreurs :

```javascript
try {
  const result = await generateContent(prompt);
  // Utiliser le contenu
} catch (error) {
  if (error.status === 429) {
    // Rate limit atteint - attendre ou upgrader
    console.log('Limite atteinte, réessayer plus tard');
  } else if (error.status === 401) {
    // Clé invalide - vérifier la configuration
    console.log('Vérifier votre clé API');
  } else {
    // Autres erreurs
    console.error('Erreur:', error.message);
  }
}
```

### 2. Mise en cache

Cachez les réponses statiques comme `/structures` et `/platforms` :

```javascript
let structuresCache = null;
let structuresCacheTime = 0;
const CACHE_TTL = 3600000; // 1 heure

async function getStructures() {
  const now = Date.now();
  if (structuresCache && (now - structuresCacheTime) < CACHE_TTL) {
    return structuresCache;
  }

  const response = await fetch(`${BASE_URL}/structures`, {
    headers: { 'Authorization': `Bearer ${SOS_API_KEY}` }
  });

  structuresCache = await response.json();
  structuresCacheTime = now;
  return structuresCache;
}
```

### 3. Retry avec backoff exponentiel

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      if (response.status === 429 || response.status >= 500) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

### 4. Surveillance de l'usage

Vérifiez régulièrement votre consommation :

```javascript
async function checkUsageAndWarn() {
  const usage = await fetch(`${BASE_URL}/usage`, {
    headers: { 'Authorization': `Bearer ${SOS_API_KEY}` }
  }).then(r => r.json());

  const percentUsed = (usage.usage.limits.used / usage.usage.limits.monthly) * 100;

  if (percentUsed > 80) {
    console.warn(`⚠️ Attention: ${percentUsed.toFixed(1)}% de votre quota utilisé`);
  }

  return usage;
}
```

---

## 📞 Support

- **Email:** support@sos-storytelling.com
- **Documentation:** https://docs.sos-storytelling.com
- **Status API:** https://status.sos-storytelling.com

---

## 📝 Changelog

### v1.0.0 (Janvier 2024)
- Lancement initial de l'API
- Endpoints: /generate, /voices, /usage, /structures, /platforms
- Authentification par clé API
- Rate limiting mensuel
