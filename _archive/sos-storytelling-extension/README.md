# SOS Storytelling - Extension Chrome LinkedIn

Extension Chrome pour exporter vos leads depuis LinkedIn Sales Navigator vers SOS Storytelling.

## Fonctionnalites

- **Detection automatique** : L'extension detecte quand vous etes sur Sales Navigator
- **Selection facile** : Cochez les leads que vous souhaitez exporter ou selectionnez toute la page
- **Export en un clic** : Envoyez vos leads directement vers vos campagnes SOS Storytelling
- **Gestion des doublons** : Les leads deja presents sont automatiquement ignores
- **100% gratuit** : Aucun cout supplementaire, inclus dans votre abonnement SOS Storytelling

## Installation

### Mode developpeur (recommande pour les tests)

1. **Telecharger l'extension**
   - Telechargez le dossier `sos-storytelling-extension` complet

2. **Ouvrir Chrome Extensions**
   - Allez sur `chrome://extensions/`
   - Activez le "Mode developpeur" en haut a droite

3. **Charger l'extension**
   - Cliquez sur "Charger l'extension non empaquetee"
   - Selectionnez le dossier `sos-storytelling-extension`

4. **Epingler l'extension**
   - Cliquez sur l'icone puzzle dans la barre Chrome
   - Epinglez "SOS Storytelling" pour un acces rapide

### Via le Chrome Web Store (bientot disponible)

L'extension sera bientot disponible sur le Chrome Web Store pour une installation en un clic.

## Utilisation

### 1. Se connecter

1. Cliquez sur l'icone SOS Storytelling dans votre barre Chrome
2. Entrez vos identifiants SOS Storytelling (email + mot de passe)
3. Une fois connecte, vous verrez la liste de vos campagnes

### 2. Selectionner des leads sur Sales Navigator

1. Allez sur LinkedIn Sales Navigator (linkedin.com/sales/)
2. Effectuez une recherche de leads
3. Un bouton flottant "SOS Storytelling" apparait en bas a droite
4. Deux methodes pour selectionner :
   - **Individuel** : Cochez la case a cote de chaque lead
   - **En masse** : Cliquez sur "Selectionner tout" dans le panneau

### 3. Exporter vers SOS Storytelling

1. Cliquez sur le bouton flottant pour ouvrir le panneau
2. Verifiez les leads selectionnes
3. Cliquez sur "Exporter vers SOS Storytelling"
4. Choisissez la campagne cible dans le popup de l'extension
5. Cliquez sur "Exporter"

### 4. Retrouver vos leads

Les leads importes apparaissent dans votre dashboard SOS Storytelling :
- Section "Prospects"
- Filtre par source : "linkedin_extension"
- Tag automatique : #linkedin #extension

## Donnees extraites

L'extension extrait les informations **visibles** sur la page :

| Donnee | Description |
|--------|-------------|
| Prenom | Prenom du prospect |
| Nom | Nom de famille |
| Poste | Titre professionnel |
| Entreprise | Nom de l'entreprise |
| URL LinkedIn | Lien vers le profil |
| Localisation | Ville/Region (si visible) |

> **Note** : LinkedIn Sales Navigator n'affiche pas les emails. Les prospects importes auront une adresse email temporaire (`@linkedin.enrichment.pending`) que vous pourrez enrichir ulterieurement avec un outil dedieA (Dropcontact, Hunter, etc.).

## Limites et bonnes pratiques

### Limites techniques

- **Maximum 100 leads** par export
- **Export manuel uniquement** - pas d'automatisation pour respecter les CGU LinkedIn
- Les doublons (meme URL LinkedIn) sont automatiquement ignores

### Bonnes pratiques

1. **Ne pas scraper massivement** - Utilisez l'extension de facon raisonnee
2. **Respecter les CGU LinkedIn** - L'extension est un outil d'aide, pas d'automatisation
3. **Enrichir les emails** - Pensez a enrichir les prospects importes avec un outil tiers
4. **Organiser par campagnes** - Creez une campagne dediee avant d'importer

## Depannage

### L'extension ne detecte pas Sales Navigator

- Verifiez que vous etes bien sur `linkedin.com/sales/`
- Rafraichissez la page
- Verifiez que l'extension est activee dans `chrome://extensions/`

### Les checkboxes n'apparaissent pas

- Attendez le chargement complet de la page
- LinkedIn met parfois a jour son interface - contactez-nous si le probleme persiste

### Erreur "Non connecte"

- Cliquez sur l'icone de l'extension
- Reconnectez-vous avec vos identifiants
- Verifiez que votre abonnement SOS Storytelling est actif

### Les leads ne s'exportent pas

- Verifiez votre connexion internet
- Assurez-vous d'avoir selectionne une campagne
- Verifiez que vous n'avez pas atteint la limite de 100 leads

## Support

- **Email** : support@sos-storytelling.com
- **Documentation** : https://sos-storytelling.com/docs
- **Bugs** : Signalez les problemes via le support

## Changelog

### v1.0.0 (Decembre 2024)
- Version initiale
- Support Sales Navigator (recherche et listes)
- Selection individuelle et en masse
- Export vers campagnes existantes
- Gestion des doublons

## Licence

Cette extension est fournie gratuitement avec votre abonnement SOS Storytelling.
Usage personnel et professionnel autorise. Revente et redistribution interdites.

---

Fait avec ♥ par l'equipe SOS Storytelling
