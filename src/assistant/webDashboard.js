import QRCode from 'qrcode';
import os from 'os';
import config from '../../config.cjs';
import supabaseManager from './supabaseClient.js';

/**
 * Gestionnaire du tableau de bord Web et des endpoints de connexion
 */
export function setupWebDashboard(app, botContext) {
    // 1. Endpoint API : Statut en temps réel
    app.get('/api/status', async (req, res) => {
        const state = botContext.getState();
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        let qrDataUrl = null;
        if (state.rawQR) {
            try {
                qrDataUrl = await QRCode.toDataURL(state.rawQR, { margin: 2, scale: 7 });
            } catch (_) {}
        }

        res.json({
            status: state.status, // 'connected', 'pairing', 'disconnected'
            phoneNumber: state.phoneNumber || config.PAIRING_NUMBER || "",
            pairingCode: state.pairingCode || null,
            qrImage: qrDataUrl,
            user: state.user || null,
            uptime: `${hours}h ${minutes}m ${seconds}s`,
            memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`,
            supabase: supabaseManager.isConfigured(),
            aiModel: config.AI_MODEL || "gemini-1.5-flash",
            botName: config.AI_ASSISTANT_NAME || "ALG Assistant"
        });
    });

    // 2. Endpoint API : Génération de Code de Jumelage (Pairing Code)
    app.post('/api/pair', async (req, res) => {
        try {
            const { phoneNumber } = req.body || {};
            if (!phoneNumber) {
                return res.status(400).json({ error: "Numéro de téléphone requis." });
            }

            const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (cleanNumber.length < 8) {
                return res.status(400).json({ error: "Numéro de téléphone invalide (inclus l'indicatif pays)." });
            }

            const code = await botContext.requestPairingCode(cleanNumber);
            res.json({ success: true, pairingCode: code });
        } catch (error) {
            console.error('Erreur API /api/pair:', error);
            res.status(500).json({ error: error.message || "Échec de la génération du code." });
        }
    });

    // 3. Endpoint API : Redémarrage de la connexion
    app.post('/api/restart', async (req, res) => {
        try {
            await botContext.restartConnection();
            res.json({ success: true, message: "Redémarrage de la connexion en cours..." });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 4. Endpoint Principal : Page Web Dashboard
    app.get('/', (req, res) => {
        res.send(getDashboardHtml());
    });
}

function getDashboardHtml() {
    return `<!DOCTYPE html>
<html lang="fr" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ALG-MD • Tableau de Bord & Connexion WhatsApp</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass { background: rgba(18, 24, 38, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); }
        .glow-emerald { box-shadow: 0 0 35px -5px rgba(16, 185, 129, 0.3); }
        .glow-card { box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5); }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-white">

    <!-- En-tête -->
    <header class="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur sticky top-0 z-50">
        <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-xl text-slate-950 shadow-lg shadow-emerald-500/20">
                    A
                </div>
                <div>
                    <h1 class="font-bold text-lg leading-tight flex items-center gap-2">
                        ALG-MD <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">Assistant v10.8</span>
                    </h1>
                    <p class="text-xs text-slate-400">Gestionnaire de Connexion WhatsApp & IA</p>
                </div>
            </div>

            <div id="status-badge" class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Chargement...</span>
            </div>
        </div>
    </header>

    <!-- Contenu Principal -->
    <main class="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">

        <!-- Carte d'État Connecté (Affichée uniquement si connecté) -->
        <div id="connected-card" class="hidden glass rounded-3xl p-6 sm:p-8 border border-emerald-500/30 glow-emerald flex flex-col md:flex-row items-center justify-between gap-6">
            <div class="flex items-center gap-5">
                <div class="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-3xl font-bold border border-emerald-500/30">
                    ✓
                </div>
                <div>
                    <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 mb-1 border border-emerald-500/20">
                        SESSION ACTIVE & CONNECTÉE
                    </div>
                    <h2 class="text-2xl font-black text-white" id="connected-name">Assistant WhatsApp</h2>
                    <p class="text-slate-400 text-sm mt-0.5">Numéro lié : <span id="connected-phone" class="font-semibold text-emerald-300 font-mono">...</span></p>
                </div>
            </div>
            <div class="flex items-center gap-3 w-full md:w-auto">
                <button onclick="restartConn()" class="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition flex items-center justify-center gap-2 border border-slate-700">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    Recharger Session
                </button>
            </div>
        </div>

        <!-- Section de Jumelage (Affichée si non connecté) -->
        <div id="pairing-section" class="grid grid-cols-1 lg:grid-cols-12 gap-6">

            <!-- Colonne Gauche : Code de Jumelage (Pairing Code) -->
            <div class="lg:col-span-7 glass rounded-3xl p-6 sm:p-8 glow-card flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">Méthode Recommandée</span>
                        <span class="text-xs text-slate-400">Rapide & sans caméra</span>
                    </div>

                    <h2 class="text-xl sm:text-2xl font-black text-white">Connexion par Code à 8 Chiffres</h2>
                    <p class="text-slate-400 text-sm mt-1 mb-6">
                        Entrez votre numéro de téléphone WhatsApp avec l'indicatif pays pour générer un code de liaison officiel.
                    </p>

                    <!-- Formulaire de saisie -->
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-semibold text-slate-300 uppercase mb-2">Numéro WhatsApp (avec indicatif)</label>
                            <div class="flex gap-2">
                                <input id="phone-input" type="tel" placeholder="ex: 509444727644 ou 33612345678" value="" class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-sm transition">
                                <button id="btn-generate-code" onclick="generatePairCode()" class="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 shrink-0">
                                    <span>Générer</span>
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                                </button>
                            </div>
                        </div>

                        <!-- Boîte d'affichage du Code de Jumelage -->
                        <div id="pair-code-display" class="hidden p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/90 border border-emerald-500/40 text-center space-y-3">
                            <span class="text-xs font-bold text-emerald-400 uppercase tracking-widest">Votre Code de Jumelage</span>
                            <div class="flex items-center justify-center gap-3">
                                <span id="code-text" class="text-3xl sm:text-4xl font-mono font-black tracking-widest text-emerald-400 select-all">--------</span>
                                <button onclick="copyCode()" class="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition" title="Copier le code">
                                    <svg id="copy-icon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                </button>
                            </div>
                            <p class="text-xs text-slate-400">Valable environ 2 à 3 minutes. Le bot se connecte dès la saisie.</p>
                        </div>
                    </div>
                </div>

                <!-- Étapes d'instructions -->
                <div class="mt-8 pt-6 border-t border-slate-800 text-xs text-slate-400 space-y-2">
                    <p class="font-bold text-slate-300 uppercase tracking-wider mb-2">Instructions sur votre téléphone :</p>
                    <div class="flex items-start gap-2">
                        <span class="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center shrink-0">1</span>
                        <span>Ouvrez <strong>WhatsApp</strong> > <strong>Paramètres</strong> > <strong>Appareils connectés</strong></span>
                    </div>
                    <div class="flex items-start gap-2">
                        <span class="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center shrink-0">2</span>
                        <span>Appuyez sur <strong>Connecter un appareil</strong></span>
                    </div>
                    <div class="flex items-start gap-2">
                        <span class="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center shrink-0">3</span>
                        <span>En bas, appuyez sur <strong>« Lier avec un numéro de téléphone »</strong> et tapez le code ci-dessus</span>
                    </div>
                </div>
            </div>

            <!-- Colonne Droite : Scanner le QR Code -->
            <div class="lg:col-span-5 glass rounded-3xl p-6 sm:p-8 glow-card flex flex-col items-center justify-between text-center">
                <div class="w-full">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-xs font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">Alternative</span>
                        <span class="text-xs text-slate-400">Caméra</span>
                    </div>
                    <h2 class="text-xl font-black text-white">Scanner le QR Code</h2>
                    <p class="text-slate-400 text-sm mt-1 mb-5">Scannez ce code depuis l'application WhatsApp.</p>
                </div>

                <div class="my-auto py-2">
                    <div id="qr-container" class="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl bg-white p-3 shadow-2xl flex items-center justify-center">
                        <div id="qr-loading" class="text-slate-600 text-sm flex flex-col items-center gap-2">
                            <svg class="animate-spin h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                            <span>Chargement du QR...</span>
                        </div>
                        <img id="qr-image" class="hidden w-full h-full object-contain" alt="QR Code WhatsApp" />
                    </div>
                </div>

                <p class="text-xs text-slate-500 mt-4">Actualisation automatique toutes les quelques secondes.</p>
            </div>

        </div>

        <!-- Grille d'Informations et Services -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="glass rounded-2xl p-4">
                <span class="text-xs text-slate-400 font-medium">Uptime Serveur</span>
                <p id="stat-uptime" class="text-base sm:text-lg font-bold text-white mt-1">--</p>
            </div>
            <div class="glass rounded-2xl p-4">
                <span class="text-xs text-slate-400 font-medium">Mémoire Utilisée</span>
                <p id="stat-memory" class="text-base sm:text-lg font-bold text-white mt-1">--</p>
            </div>
            <div class="glass rounded-2xl p-4">
                <span class="text-xs text-slate-400 font-medium">Base Supabase</span>
                <p id="stat-supabase" class="text-base sm:text-lg font-bold text-emerald-400 mt-1">Vérification...</p>
            </div>
            <div class="glass rounded-2xl p-4">
                <span class="text-xs text-slate-400 font-medium">Modèle IA Actif</span>
                <p id="stat-model" class="text-base sm:text-lg font-bold text-teal-400 mt-1">Gemini 1.5</p>
            </div>
        </div>

    </main>

    <!-- Pied de page -->
    <footer class="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        ALG-MD Intelligent WhatsApp Assistant • Propulsé par Google DeepMind Gemini & Baileys Multi-Device
    </footer>

    <!-- Script de mise à jour en temps réel -->
    <script>
        let currentPairingCode = null;

        async function fetchStatus() {
            try {
                const res = await fetch('/api/status');
                if (!res.ok) return;
                const data = await res.json();

                // 1. Mise à jour du badge de statut
                const badge = document.getElementById('status-badge');
                const connCard = document.getElementById('connected-card');
                const pairSection = document.getElementById('pairing-section');

                if (data.status === 'connected') {
                    badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span><span>Connecté ✅</span>';
                    
                    connCard.classList.remove('hidden');
                    pairSection.classList.add('hidden');
                    
                    document.getElementById('connected-name').innerText = data.botName || "ALG Assistant";
                    document.getElementById('connected-phone').innerText = (data.user?.id ? data.user.id.split(':')[0] : data.phoneNumber) || "Connecté";
                } else if (data.status === 'pairing') {
                    badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20";
                    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span><span>En attente de connexion ⏳</span>';
                    connCard.classList.add('hidden');
                    pairSection.classList.remove('hidden');
                } else {
                    badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20";
                    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-400"></span><span>Déconnecté ❌</span>';
                    connCard.classList.add('hidden');
                    pairSection.classList.remove('hidden');
                }

                // 2. Affichage du code de jumelage si disponible
                if (data.pairingCode && !currentPairingCode) {
                    currentPairingCode = data.pairingCode;
                    displayPairCode(data.pairingCode);
                }

                // Pré-remplir le numéro si configuré
                const phoneInput = document.getElementById('phone-input');
                if (!phoneInput.value && data.phoneNumber) {
                    phoneInput.value = data.phoneNumber;
                }

                // 3. Affichage de l'image QR code
                const qrImg = document.getElementById('qr-image');
                const qrLoading = document.getElementById('qr-loading');
                if (data.qrImage) {
                    qrImg.src = data.qrImage;
                    qrImg.classList.remove('hidden');
                    qrLoading.classList.add('hidden');
                }

                // 4. Statistiques
                document.getElementById('stat-uptime').innerText = data.uptime || '--';
                document.getElementById('stat-memory').innerText = data.memory || '--';
                document.getElementById('stat-supabase').innerText = data.supabase ? 'Connecté ✅' : 'Non configuré';
                document.getElementById('stat-model').innerText = data.aiModel || 'Gemini 1.5';

            } catch (err) {
                console.warn('Erreur polling statut:', err);
            }
        }

        function displayPairCode(code) {
            const formatted = code.length === 8 ? (code.slice(0, 4) + ' - ' + code.slice(4)) : code;
            document.getElementById('code-text').innerText = formatted;
            document.getElementById('pair-code-display').classList.remove('hidden');
        }

        async function generatePairCode() {
            const phone = document.getElementById('phone-input').value.trim();
            if (!phone) {
                alert("Veuillez saisir votre numéro WhatsApp avec indicatif (ex: 509444727644)");
                return;
            }

            const btn = document.getElementById('btn-generate-code');
            btn.disabled = true;
            btn.innerHTML = '<span>Génération...</span>';

            try {
                const res = await fetch('/api/pair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: phone })
                });

                const data = await res.json();
                if (data.success && data.pairingCode) {
                    currentPairingCode = data.pairingCode;
                    displayPairCode(data.pairingCode);
                } else {
                    alert(data.error || "Erreur lors de la génération du code.");
                }
            } catch (e) {
                alert("Erreur réseau : " + e.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span>Générer</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>';
            }
        }

        function copyCode() {
            const raw = (currentPairingCode || document.getElementById('code-text').innerText).replace(/[^a-zA-Z0-9]/g, '');
            navigator.clipboard.writeText(raw).then(() => {
                const icon = document.getElementById('copy-icon');
                icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>';
                setTimeout(() => {
                    icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>';
                }, 2000);
            });
        }

        async function restartConn() {
            if (confirm("Voulez-vous recharger la session WhatsApp ?")) {
                await fetch('/api/restart', { method: 'POST' });
                alert("Redémarrage en cours...");
                setTimeout(fetchStatus, 2000);
            }
        }

        // Polling toutes les 2.5 secondes
        fetchStatus();
        setInterval(fetchStatus, 2500);
    </script>
</body>
</html>`;
}

export default setupWebDashboard;
