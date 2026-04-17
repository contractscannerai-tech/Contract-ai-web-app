import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type LangCode = "en" | "es" | "fr" | "pt" | "ar" | "hi" | "de" | "zh";

export const LANGUAGES: Array<{ code: LangCode; name: string; nativeName: string; flag: string }> = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
];

const RTL_LANGS: Set<LangCode> = new Set(["ar"]);
const STORAGE_KEY = "contractai.lang";

const EN: Record<string, string> = {
  "nav.pricing": "Pricing",
  "nav.login": "Login",
  "nav.getStarted": "Get started",
  "nav.dashboard": "Dashboard",
  "nav.contracts": "Contracts",
  "nav.upload": "Upload",
  "nav.settings": "Settings",
  "nav.logout": "Logout",
  "nav.signOut": "Sign out",

  "landing.badge": "AI-Powered Legal Analysis",
  "landing.hero.title": "Understand any contract",
  "landing.hero.title2": " in seconds.",
  "landing.hero.subtitle": "Your contract analyzer in your pocket — without paying expensive lawyers. Upload a PDF and get an instant plain-English summary, risk analysis, and key clause extraction.",
  "landing.hero.cta": "Analyze your first contract free",
  "landing.hero.viewPlans": "View plans",
  "landing.hero.noCC": "No credit card required. Free plan includes 3 contracts.",
  "landing.features.title": "Everything you need to review contracts confidently",
  "landing.features.subtitle": "Stop signing contracts you don't fully understand. ContractAI gives you the clarity lawyers charge hundreds per hour for.",
  "landing.feat.summary.title": "Instant AI Summary",
  "landing.feat.summary.desc": "Get a plain-English summary of any contract in seconds. No legal jargon, no confusion — just clarity.",
  "landing.feat.risk.title": "Risk Detection",
  "landing.feat.risk.desc": "AI flags clauses that could hurt you — unfair penalties, liability traps, one-sided termination rights.",
  "landing.feat.clause.title": "Key Clause Extraction",
  "landing.feat.clause.desc": "The most important provisions highlighted and explained so you know exactly what you're agreeing to.",
  "landing.howItWorks.title": "How it works",
  "landing.howItWorks.subtitle": "Three steps to contract clarity",
  "landing.step1.title": "Upload your PDF",
  "landing.step1.desc": "Drag and drop or select your contract PDF. We accept any legal document up to 10MB.",
  "landing.step2.title": "AI analyzes it",
  "landing.step2.desc": "Our AI reads every clause, flags risks, and distills the key points into plain language.",
  "landing.step3.title": "Review and decide",
  "landing.step3.desc": "See the summary, risks, and key clauses. Chat with AI for deeper questions. Sign with confidence.",
  "landing.trusted.title": "Trusted by thousands",
  "landing.pricing.title": "Simple, transparent pricing",
  "landing.pricing.subtitle": "Start free. Upgrade when you need more.",
  "landing.pricing.cta": "See full pricing details",
  "landing.trust.encryption": "Bank-grade encryption",
  "landing.trust.data": "Data never sold",
  "landing.trust.soc2": "SOC2 compliant infrastructure",
  "landing.cta.title": "Ready to stop guessing?",
  "landing.cta.subtitle": "Start analyzing contracts today. It's free to get started.",
  "landing.cta.button": "Start for free",
  "landing.footer.rights": "© 2026 ContractAI. All rights reserved.",
  "landing.footer.privacy": "Privacy Policy",

  "dashboard.title": "Dashboard",
  "dashboard.uploadContract": "Upload contract",
  "dashboard.quickActions": "Quick Actions",
  "dashboard.unlockFeatures": "Unlock all features →",
  "dashboard.stats.total": "Total Contracts",
  "dashboard.stats.analyzed": "Analyzed",
  "dashboard.stats.highRisk": "High Risk",
  "dashboard.stats.planUsage": "Plan Usage",
  "dashboard.planUsage": "Plan Usage",
  "dashboard.unlimited": "Unlimited",
  "dashboard.upgradeWarning": "Running low — upgrade before you hit the limit.",
  "dashboard.upgradePlan": "Upgrade plan",
  "dashboard.recentActivity": "Recent Activity",
  "dashboard.viewAll": "View all",
  "dashboard.noContracts": "No contracts yet",
  "dashboard.noContractsDesc": "Upload your first contract to get started",
  "dashboard.uploadFirst": "Upload a contract",
  "dashboard.contractsAnalyzed": "contracts analyzed",
  "dashboard.contractsUsed": "contracts used",

  "contracts.title": "Contracts",
  "contracts.total": "contracts total",
  "contracts.upload": "Upload",
  "contracts.search": "Search contracts...",
  "contracts.noMatch": "No contracts match your search",
  "contracts.noContracts": "No contracts yet",
  "contracts.tryDifferent": "Try a different search term",
  "contracts.getStarted": "Upload your first contract to get started",
  "contracts.uploadContract": "Upload a contract",
  "contracts.deleteConfirm": "Delete this contract? This action cannot be undone.",

  "upload.title": "Upload Contract",
  "upload.subtitle": "Drop a PDF or photo — we'll extract the text automatically, then analyze it with AI when you're ready.",
  "upload.freePlanUsed": "Free plan: {used}/{limit} contracts used",
  "upload.upgradeMore": "Upgrade for more",
  "upload.dropHere": "Drop your contract here",
  "upload.clickBrowse": "or click to browse files",
  "upload.pdfOnly": "PDF only on Free plan · Max 10MB",
  "upload.pdfOrImage": "PDF or image (JPEG, PNG, WebP) · Max 10MB",
  "upload.upgradePhotos": "Upgrade to scan photos",
  "upload.removeFile": "Remove file",
  "upload.readyToAnalyze": "Ready to analyze",
  "upload.compressing": "Compressing image…",
  "upload.optimizing": "Optimising for faster upload",
  "upload.runningOCR": "Running OCR scan…",
  "upload.extractingText": "Extracting digital text…",
  "upload.ocrProgress": "Sending image to OCR engine",
  "upload.pdfProgress": "Parsing PDF directly — no OCR needed",
  "upload.ocrComplete": "OCR scan complete",
  "upload.textExtracted": "Digital text extracted",
  "upload.readyForAI": "ready for AI analysis",
  "upload.clickAnalyze": "Click Analyze below to run the AI review",
  "upload.analyzing": "Analyzing with AI…",
  "upload.analyzingTime": "This typically takes 10–30 seconds",
  "upload.analysisComplete": "Analysis complete!",
  "upload.redirecting": "Redirecting to your report…",
  "upload.analysisFailed": "Analysis failed.",
  "upload.notCharged": "You have not been charged for this attempt.",
  "upload.retryBelow": "Your file is still uploaded — you can try analyzing again below.",
  "upload.analyzeContract": "Analyze contract",
  "upload.retryAnalysis": "Retry analysis",
  "upload.selectFile": "Select a file to get started",
  "upload.uploading": "Uploading…",
  "upload.secureProcessing": "Your contract is processed securely and never shared with third parties.",

  "settings.title": "Settings",
  "settings.account": "Account",
  "settings.accountEmail": "Account email",
  "settings.memberSince": "Member since",
  "settings.plan": "Plan",
  "settings.upgradePlan": "Upgrade plan",
  "settings.contractsUsed": "of {limit} contracts used",
  "settings.unlimitedUsed": "contracts used",
  "settings.bonus": "+{count} bonus",
  "settings.appearance": "Appearance",
  "settings.light": "Light",
  "settings.dark": "Dark",
  "settings.language": "Language",
  "settings.languageDesc": "Choose your preferred language. AI responses will also be in this language.",
  "settings.referral": "Referral Program",
  "settings.referralCode": "Your referral code",
  "settings.copy": "Copy",
  "settings.copied": "Copied",
  "settings.referrals": "Referrals",
  "settings.bonusScansEarned": "Bonus scans earned",
  "settings.shareCodeInfo": "Share your code and earn bonus scans:",
  "settings.signUpBonus": "Friend signs up: +3 scans",
  "settings.proBonus": "Friend subscribes to Pro: +5 scans",
  "settings.premiumBonus": "Friend subscribes to Premium: +10 scans",
  "settings.haveCode": "Have a referral code?",
  "settings.enterCode": "Enter referral code",
  "settings.apply": "Apply",
  "settings.applying": "Applying...",
  "settings.quickActions": "Quick Actions",
  "settings.viewContracts": "View all contracts",
  "settings.uploadNew": "Upload new contract",
  "settings.privacyData": "Privacy & Data",
  "settings.privacy1": "Uploaded files are processed in-memory only and",
  "settings.privacy1b": "never permanently stored",
  "settings.privacy2": "Raw contract text is",
  "settings.privacy2b": "permanently deleted",
  "settings.privacy2c": "within seconds of AI analysis completing.",
  "settings.privacy3": "Only structured analysis results (summary, risks, key clauses) are retained while your account is active.",
  "settings.privacy4a": "Your email is used only for authentication and support —",
  "settings.privacy4b": "never for marketing",
  "settings.readPrivacy": "Read full Privacy Policy",
  "settings.session": "Session",
  "settings.signOut": "Sign out",
  "settings.signingOut": "Signing out...",
  "settings.dangerZone": "Danger Zone",
  "settings.dangerDesc": "Permanently delete your account and all associated data. This action cannot be undone.",
  "settings.deleteAccount": "Delete account",
  "settings.deleteWarning": "This will permanently delete:",
  "settings.deleteItem1": "All your uploaded contracts and their analysis results",
  "settings.deleteItem2": "All your AI chat history",
  "settings.deleteItem3": "Your account credentials and profile",
  "settings.deleteItem4": "All subscription data",
  "settings.cannotUndo": "This cannot be undone.",
  "settings.typeDelete": "Type {word} to confirm",
  "settings.cancel": "Cancel",
  "settings.permanentlyDelete": "Permanently delete account",
  "settings.deleting": "Deleting...",

  "auth.login": "Login",
  "auth.loginDesc": "Login to your existing ContractAI account",
  "auth.continueGoogle": "Continue with Google",
  "auth.registerGoogle": "Register with Google",
  "auth.orEmail": "or sign in with email",
  "auth.orCreateEmail": "or create with email",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.submit": "Login",
  "auth.newTo": "New to ContractAI?",
  "auth.createFree": "Create a free account — no credit card required",
  "auth.createAccount": "Create New Account",
  "auth.chooseMethod": "Choose your sign-up method below",
  "auth.termsAccepted": "Terms of Service accepted",
  "auth.minPassword": "Minimum 8 characters",
  "auth.createBtn": "Create account",
  "auth.alreadyHave": "Already have an account?",
  "auth.privacyAcknowledge": "By continuing, you acknowledge our",

  "pricing.title": "Choose your protection level",
  "pricing.subtitle": "Start free. The Starter plan shows you where risks exist. Upgrade to learn why they matter — and how to fight back.",
  "pricing.currentPlan": "Current plan",
  "pricing.comparison.title": "Free vs. Legal Partner — the key difference",
  "pricing.comparison.desc": "The Starter plan tells you a risk exists at Section 4.2. The Legal Partner plan tells you exactly what it means, why it could cost you money, and how to renegotiate it before you sign.",
  "pricing.faq.title": "Common questions",
  "pricing.forever": "forever",
  "pricing.perMonth": "/month",
  "pricing.paymentError": "Payment error",
  "pricing.checkoutFailed": "Could not create checkout session.",
  "pricing.checkoutRetry": "Could not start checkout. Please try again.",

  "common.contractAI": "ContractAI",
  "common.rights": "© 2026 ContractAI. All rights reserved.",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.loading": "Loading...",
  "common.language": "Language",
};

const ES: Record<string, string> = {
  "nav.pricing": "Precios", "nav.login": "Iniciar sesión", "nav.getStarted": "Comenzar",
  "nav.dashboard": "Panel", "nav.contracts": "Contratos", "nav.upload": "Subir",
  "nav.settings": "Ajustes", "nav.logout": "Cerrar sesión", "nav.signOut": "Cerrar sesión",
  "common.cancel": "Cancelar", "common.save": "Guardar", "common.loading": "Cargando...", "common.language": "Idioma",
  "common.rights": "© 2026 ContractAI. Todos los derechos reservados.",
  "dashboard.title": "Panel", "dashboard.uploadContract": "Subir contrato",
  "dashboard.quickActions": "Acciones rápidas", "dashboard.stats.total": "Contratos totales",
  "dashboard.stats.analyzed": "Analizados", "dashboard.stats.highRisk": "Alto riesgo",
  "dashboard.stats.planUsage": "Uso del plan", "dashboard.planUsage": "Uso del plan",
  "dashboard.unlimited": "Ilimitado", "dashboard.upgradePlan": "Mejorar plan",
  "dashboard.recentActivity": "Actividad reciente", "dashboard.viewAll": "Ver todo",
  "dashboard.noContracts": "Aún no hay contratos", "dashboard.uploadFirst": "Subir un contrato",
  "contracts.title": "Contratos", "contracts.upload": "Subir", "contracts.search": "Buscar contratos...",
  "upload.title": "Subir contrato", "upload.dropHere": "Suelta tu contrato aquí",
  "upload.analyzeContract": "Analizar contrato", "upload.analyzing": "Analizando con IA…",
  "upload.analysisComplete": "¡Análisis completo!", "upload.analysisFailed": "Análisis fallido.",
  "settings.title": "Ajustes", "settings.account": "Cuenta", "settings.accountEmail": "Correo de la cuenta",
  "settings.memberSince": "Miembro desde", "settings.plan": "Plan", "settings.upgradePlan": "Mejorar plan",
  "settings.appearance": "Apariencia", "settings.light": "Claro", "settings.dark": "Oscuro",
  "settings.language": "Idioma", "settings.languageDesc": "Elige tu idioma preferido. Las respuestas de IA también estarán en este idioma.",
  "settings.signOut": "Cerrar sesión", "settings.deleteAccount": "Eliminar cuenta", "settings.dangerZone": "Zona peligrosa",
  "auth.login": "Iniciar sesión", "auth.email": "Correo", "auth.password": "Contraseña",
  "auth.submit": "Iniciar sesión", "auth.createAccount": "Crear cuenta nueva", "auth.createBtn": "Crear cuenta",
  "pricing.title": "Elige tu nivel de protección", "pricing.currentPlan": "Plan actual",
  "pricing.forever": "para siempre", "pricing.perMonth": "/mes",
};

const FR: Record<string, string> = {
  "nav.pricing": "Tarifs", "nav.login": "Connexion", "nav.getStarted": "Commencer",
  "nav.dashboard": "Tableau de bord", "nav.contracts": "Contrats", "nav.upload": "Téléverser",
  "nav.settings": "Paramètres", "nav.logout": "Déconnexion", "nav.signOut": "Déconnexion",
  "common.cancel": "Annuler", "common.save": "Enregistrer", "common.loading": "Chargement...", "common.language": "Langue",
  "common.rights": "© 2026 ContractAI. Tous droits réservés.",
  "dashboard.title": "Tableau de bord", "dashboard.uploadContract": "Téléverser un contrat",
  "dashboard.quickActions": "Actions rapides", "dashboard.stats.total": "Contrats totaux",
  "dashboard.stats.analyzed": "Analysés", "dashboard.stats.highRisk": "Risque élevé",
  "dashboard.stats.planUsage": "Utilisation du plan", "dashboard.planUsage": "Utilisation du plan",
  "dashboard.unlimited": "Illimité", "dashboard.upgradePlan": "Améliorer le plan",
  "dashboard.recentActivity": "Activité récente", "dashboard.viewAll": "Voir tout",
  "dashboard.noContracts": "Aucun contrat pour l'instant", "dashboard.uploadFirst": "Téléverser un contrat",
  "contracts.title": "Contrats", "contracts.upload": "Téléverser", "contracts.search": "Rechercher des contrats...",
  "upload.title": "Téléverser un contrat", "upload.dropHere": "Déposez votre contrat ici",
  "upload.analyzeContract": "Analyser le contrat", "upload.analyzing": "Analyse par IA en cours…",
  "upload.analysisComplete": "Analyse terminée !", "upload.analysisFailed": "L'analyse a échoué.",
  "settings.title": "Paramètres", "settings.account": "Compte", "settings.accountEmail": "Email du compte",
  "settings.memberSince": "Membre depuis", "settings.plan": "Plan", "settings.upgradePlan": "Améliorer le plan",
  "settings.appearance": "Apparence", "settings.light": "Clair", "settings.dark": "Sombre",
  "settings.language": "Langue", "settings.languageDesc": "Choisissez votre langue préférée. Les réponses de l'IA seront également dans cette langue.",
  "settings.signOut": "Déconnexion", "settings.deleteAccount": "Supprimer le compte", "settings.dangerZone": "Zone dangereuse",
  "auth.login": "Connexion", "auth.email": "Email", "auth.password": "Mot de passe",
  "auth.submit": "Connexion", "auth.createAccount": "Créer un nouveau compte", "auth.createBtn": "Créer un compte",
  "pricing.title": "Choisissez votre niveau de protection", "pricing.currentPlan": "Plan actuel",
  "pricing.forever": "pour toujours", "pricing.perMonth": "/mois",
};

const PT: Record<string, string> = {
  "nav.pricing": "Preços", "nav.login": "Entrar", "nav.getStarted": "Começar",
  "nav.dashboard": "Painel", "nav.contracts": "Contratos", "nav.upload": "Enviar",
  "nav.settings": "Configurações", "nav.logout": "Sair", "nav.signOut": "Sair",
  "common.cancel": "Cancelar", "common.save": "Salvar", "common.loading": "Carregando...", "common.language": "Idioma",
  "common.rights": "© 2026 ContractAI. Todos os direitos reservados.",
  "dashboard.title": "Painel", "dashboard.uploadContract": "Enviar contrato",
  "dashboard.quickActions": "Ações rápidas", "dashboard.stats.total": "Contratos totais",
  "dashboard.stats.analyzed": "Analisados", "dashboard.stats.highRisk": "Alto risco",
  "dashboard.stats.planUsage": "Uso do plano", "dashboard.planUsage": "Uso do plano",
  "dashboard.unlimited": "Ilimitado", "dashboard.upgradePlan": "Atualizar plano",
  "dashboard.recentActivity": "Atividade recente", "dashboard.viewAll": "Ver tudo",
  "dashboard.noContracts": "Nenhum contrato ainda", "dashboard.uploadFirst": "Enviar um contrato",
  "contracts.title": "Contratos", "contracts.upload": "Enviar", "contracts.search": "Pesquisar contratos...",
  "upload.title": "Enviar contrato", "upload.dropHere": "Solte seu contrato aqui",
  "upload.analyzeContract": "Analisar contrato", "upload.analyzing": "Analisando com IA…",
  "upload.analysisComplete": "Análise concluída!", "upload.analysisFailed": "Falha na análise.",
  "settings.title": "Configurações", "settings.account": "Conta", "settings.accountEmail": "Email da conta",
  "settings.memberSince": "Membro desde", "settings.plan": "Plano", "settings.upgradePlan": "Atualizar plano",
  "settings.appearance": "Aparência", "settings.light": "Claro", "settings.dark": "Escuro",
  "settings.language": "Idioma", "settings.languageDesc": "Escolha seu idioma preferido. As respostas da IA também estarão neste idioma.",
  "settings.signOut": "Sair", "settings.deleteAccount": "Excluir conta", "settings.dangerZone": "Zona perigosa",
  "auth.login": "Entrar", "auth.email": "Email", "auth.password": "Senha",
  "auth.submit": "Entrar", "auth.createAccount": "Criar nova conta", "auth.createBtn": "Criar conta",
  "pricing.title": "Escolha seu nível de proteção", "pricing.currentPlan": "Plano atual",
  "pricing.forever": "para sempre", "pricing.perMonth": "/mês",
};

const DE: Record<string, string> = {
  "nav.pricing": "Preise", "nav.login": "Anmelden", "nav.getStarted": "Loslegen",
  "nav.dashboard": "Dashboard", "nav.contracts": "Verträge", "nav.upload": "Hochladen",
  "nav.settings": "Einstellungen", "nav.logout": "Abmelden", "nav.signOut": "Abmelden",
  "common.cancel": "Abbrechen", "common.save": "Speichern", "common.loading": "Laden...", "common.language": "Sprache",
  "common.rights": "© 2026 ContractAI. Alle Rechte vorbehalten.",
  "dashboard.title": "Dashboard", "dashboard.uploadContract": "Vertrag hochladen",
  "dashboard.quickActions": "Schnellaktionen", "dashboard.stats.total": "Verträge gesamt",
  "dashboard.stats.analyzed": "Analysiert", "dashboard.stats.highRisk": "Hohes Risiko",
  "dashboard.stats.planUsage": "Plan-Nutzung", "dashboard.planUsage": "Plan-Nutzung",
  "dashboard.unlimited": "Unbegrenzt", "dashboard.upgradePlan": "Plan upgraden",
  "dashboard.recentActivity": "Letzte Aktivität", "dashboard.viewAll": "Alle ansehen",
  "dashboard.noContracts": "Noch keine Verträge", "dashboard.uploadFirst": "Einen Vertrag hochladen",
  "contracts.title": "Verträge", "contracts.upload": "Hochladen", "contracts.search": "Verträge suchen...",
  "upload.title": "Vertrag hochladen", "upload.dropHere": "Vertrag hier ablegen",
  "upload.analyzeContract": "Vertrag analysieren", "upload.analyzing": "KI-Analyse läuft…",
  "upload.analysisComplete": "Analyse abgeschlossen!", "upload.analysisFailed": "Analyse fehlgeschlagen.",
  "settings.title": "Einstellungen", "settings.account": "Konto", "settings.accountEmail": "Konto-E-Mail",
  "settings.memberSince": "Mitglied seit", "settings.plan": "Plan", "settings.upgradePlan": "Plan upgraden",
  "settings.appearance": "Erscheinungsbild", "settings.light": "Hell", "settings.dark": "Dunkel",
  "settings.language": "Sprache", "settings.languageDesc": "Wählen Sie Ihre bevorzugte Sprache. KI-Antworten erfolgen ebenfalls in dieser Sprache.",
  "settings.signOut": "Abmelden", "settings.deleteAccount": "Konto löschen", "settings.dangerZone": "Gefahrenzone",
  "auth.login": "Anmelden", "auth.email": "E-Mail", "auth.password": "Passwort",
  "auth.submit": "Anmelden", "auth.createAccount": "Neues Konto erstellen", "auth.createBtn": "Konto erstellen",
  "pricing.title": "Wählen Sie Ihre Schutzstufe", "pricing.currentPlan": "Aktueller Plan",
  "pricing.forever": "für immer", "pricing.perMonth": "/Monat",
};

const AR: Record<string, string> = {
  "nav.pricing": "الأسعار", "nav.login": "تسجيل الدخول", "nav.getStarted": "ابدأ",
  "nav.dashboard": "لوحة التحكم", "nav.contracts": "العقود", "nav.upload": "تحميل",
  "nav.settings": "الإعدادات", "nav.logout": "تسجيل الخروج", "nav.signOut": "تسجيل الخروج",
  "common.cancel": "إلغاء", "common.save": "حفظ", "common.loading": "جارٍ التحميل...", "common.language": "اللغة",
  "common.rights": "© 2026 ContractAI. جميع الحقوق محفوظة.",
  "dashboard.title": "لوحة التحكم", "dashboard.uploadContract": "تحميل عقد",
  "dashboard.quickActions": "إجراءات سريعة", "dashboard.stats.total": "إجمالي العقود",
  "dashboard.stats.analyzed": "تم التحليل", "dashboard.stats.highRisk": "مخاطر عالية",
  "dashboard.stats.planUsage": "استخدام الخطة", "dashboard.planUsage": "استخدام الخطة",
  "dashboard.unlimited": "غير محدود", "dashboard.upgradePlan": "ترقية الخطة",
  "dashboard.recentActivity": "النشاط الأخير", "dashboard.viewAll": "عرض الكل",
  "dashboard.noContracts": "لا توجد عقود بعد", "dashboard.uploadFirst": "تحميل عقد",
  "contracts.title": "العقود", "contracts.upload": "تحميل", "contracts.search": "ابحث عن العقود...",
  "upload.title": "تحميل عقد", "upload.dropHere": "ضع عقدك هنا",
  "upload.analyzeContract": "تحليل العقد", "upload.analyzing": "جارٍ التحليل بالذكاء الاصطناعي…",
  "upload.analysisComplete": "اكتمل التحليل!", "upload.analysisFailed": "فشل التحليل.",
  "settings.title": "الإعدادات", "settings.account": "الحساب", "settings.accountEmail": "البريد الإلكتروني للحساب",
  "settings.memberSince": "عضو منذ", "settings.plan": "الخطة", "settings.upgradePlan": "ترقية الخطة",
  "settings.appearance": "المظهر", "settings.light": "فاتح", "settings.dark": "داكن",
  "settings.language": "اللغة", "settings.languageDesc": "اختر لغتك المفضلة. ستكون ردود الذكاء الاصطناعي بهذه اللغة أيضًا.",
  "settings.signOut": "تسجيل الخروج", "settings.deleteAccount": "حذف الحساب", "settings.dangerZone": "منطقة الخطر",
  "auth.login": "تسجيل الدخول", "auth.email": "البريد الإلكتروني", "auth.password": "كلمة المرور",
  "auth.submit": "تسجيل الدخول", "auth.createAccount": "إنشاء حساب جديد", "auth.createBtn": "إنشاء حساب",
  "pricing.title": "اختر مستوى الحماية الخاص بك", "pricing.currentPlan": "الخطة الحالية",
  "pricing.forever": "للأبد", "pricing.perMonth": "/شهر",
};

const HI: Record<string, string> = {
  "nav.pricing": "मूल्य निर्धारण", "nav.login": "लॉग इन करें", "nav.getStarted": "शुरू करें",
  "nav.dashboard": "डैशबोर्ड", "nav.contracts": "अनुबंध", "nav.upload": "अपलोड",
  "nav.settings": "सेटिंग्स", "nav.logout": "लॉग आउट", "nav.signOut": "लॉग आउट",
  "common.cancel": "रद्द करें", "common.save": "सहेजें", "common.loading": "लोड हो रहा है...", "common.language": "भाषा",
  "common.rights": "© 2026 ContractAI. सर्वाधिकार सुरक्षित.",
  "dashboard.title": "डैशबोर्ड", "dashboard.uploadContract": "अनुबंध अपलोड करें",
  "dashboard.quickActions": "त्वरित कार्य", "dashboard.stats.total": "कुल अनुबंध",
  "dashboard.stats.analyzed": "विश्लेषित", "dashboard.stats.highRisk": "उच्च जोखिम",
  "dashboard.stats.planUsage": "प्लान उपयोग", "dashboard.planUsage": "प्लान उपयोग",
  "dashboard.unlimited": "असीमित", "dashboard.upgradePlan": "प्लान अपग्रेड करें",
  "dashboard.recentActivity": "हाल की गतिविधि", "dashboard.viewAll": "सभी देखें",
  "dashboard.noContracts": "अभी तक कोई अनुबंध नहीं", "dashboard.uploadFirst": "एक अनुबंध अपलोड करें",
  "contracts.title": "अनुबंध", "contracts.upload": "अपलोड", "contracts.search": "अनुबंध खोजें...",
  "upload.title": "अनुबंध अपलोड करें", "upload.dropHere": "अपना अनुबंध यहाँ छोड़ें",
  "upload.analyzeContract": "अनुबंध का विश्लेषण करें", "upload.analyzing": "AI से विश्लेषण हो रहा है…",
  "upload.analysisComplete": "विश्लेषण पूर्ण!", "upload.analysisFailed": "विश्लेषण विफल हुआ.",
  "settings.title": "सेटिंग्स", "settings.account": "खाता", "settings.accountEmail": "खाता ईमेल",
  "settings.memberSince": "सदस्य बने", "settings.plan": "प्लान", "settings.upgradePlan": "प्लान अपग्रेड करें",
  "settings.appearance": "दिखावट", "settings.light": "हल्का", "settings.dark": "गहरा",
  "settings.language": "भाषा", "settings.languageDesc": "अपनी पसंदीदा भाषा चुनें. AI के उत्तर भी इसी भाषा में होंगे.",
  "settings.signOut": "लॉग आउट", "settings.deleteAccount": "खाता हटाएँ", "settings.dangerZone": "खतरे का क्षेत्र",
  "auth.login": "लॉग इन", "auth.email": "ईमेल", "auth.password": "पासवर्ड",
  "auth.submit": "लॉग इन", "auth.createAccount": "नया खाता बनाएँ", "auth.createBtn": "खाता बनाएँ",
  "pricing.title": "अपना सुरक्षा स्तर चुनें", "pricing.currentPlan": "वर्तमान प्लान",
  "pricing.forever": "हमेशा के लिए", "pricing.perMonth": "/माह",
};

const ZH: Record<string, string> = {
  "nav.pricing": "定价", "nav.login": "登录", "nav.getStarted": "开始使用",
  "nav.dashboard": "仪表板", "nav.contracts": "合同", "nav.upload": "上传",
  "nav.settings": "设置", "nav.logout": "退出登录", "nav.signOut": "退出登录",
  "common.cancel": "取消", "common.save": "保存", "common.loading": "加载中...", "common.language": "语言",
  "common.rights": "© 2026 ContractAI. 保留所有权利。",
  "dashboard.title": "仪表板", "dashboard.uploadContract": "上传合同",
  "dashboard.quickActions": "快速操作", "dashboard.stats.total": "合同总数",
  "dashboard.stats.analyzed": "已分析", "dashboard.stats.highRisk": "高风险",
  "dashboard.stats.planUsage": "套餐使用情况", "dashboard.planUsage": "套餐使用情况",
  "dashboard.unlimited": "无限制", "dashboard.upgradePlan": "升级套餐",
  "dashboard.recentActivity": "最近活动", "dashboard.viewAll": "查看全部",
  "dashboard.noContracts": "暂无合同", "dashboard.uploadFirst": "上传一份合同",
  "contracts.title": "合同", "contracts.upload": "上传", "contracts.search": "搜索合同...",
  "upload.title": "上传合同", "upload.dropHere": "将合同拖放到此处",
  "upload.analyzeContract": "分析合同", "upload.analyzing": "AI 正在分析…",
  "upload.analysisComplete": "分析完成！", "upload.analysisFailed": "分析失败。",
  "settings.title": "设置", "settings.account": "账户", "settings.accountEmail": "账户邮箱",
  "settings.memberSince": "注册时间", "settings.plan": "套餐", "settings.upgradePlan": "升级套餐",
  "settings.appearance": "外观", "settings.light": "浅色", "settings.dark": "深色",
  "settings.language": "语言", "settings.languageDesc": "选择您的首选语言。AI 回复也将使用此语言。",
  "settings.signOut": "退出登录", "settings.deleteAccount": "删除账户", "settings.dangerZone": "危险区域",
  "auth.login": "登录", "auth.email": "邮箱", "auth.password": "密码",
  "auth.submit": "登录", "auth.createAccount": "创建新账户", "auth.createBtn": "创建账户",
  "pricing.title": "选择您的保护级别", "pricing.currentPlan": "当前套餐",
  "pricing.forever": "永久", "pricing.perMonth": "/月",
};

const TRANSLATIONS: Record<LangCode, Record<string, string>> = {
  en: EN, es: ES, fr: FR, pt: PT, de: DE, ar: AR, hi: HI, zh: ZH,
};

function applyDirection(lang: LangCode) {
  if (typeof document === "undefined") return;
  const isRtl = RTL_LANGS.has(lang);
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

function readStoredLang(): LangCode {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v && (TRANSLATIONS as Record<string, unknown>)[v]) return v as LangCode;
  return "en";
}

interface I18nContextValue {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(() => {
    const initial = readStoredLang();
    if (typeof document !== "undefined") applyDirection(initial);
    return initial;
  });

  // On mount, fetch user language from DB — DB overrides localStorage if logged in.
  useEffect(() => {
    let cancelled = false;
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    fetch(`${base}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { language?: string } | null) => {
        if (cancelled || !data?.language) return;
        const code = data.language as string;
        if ((TRANSLATIONS as Record<string, unknown>)[code]) {
          const next = code as LangCode;
          setLangState(next);
          applyDirection(next);
          window.localStorage.setItem(STORAGE_KEY, next);
        }
      })
      .catch(() => { /* unauthenticated or offline — keep localStorage value */ });
    return () => { cancelled = true; };
  }, []);

  const setLang = useCallback((code: LangCode) => {
    if (!(TRANSLATIONS as Record<string, unknown>)[code]) return;
    setLangState(code);
    applyDirection(code);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, code);
    // Persist to DB (best-effort; ignore failure when unauthenticated).
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    void fetch(`${base}/api/auth/me/language`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: code }),
    }).catch(() => { /* ignore */ });
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const dict = TRANSLATIONS[lang] ?? EN;
    let value = dict[key] ?? EN[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v));
      });
    }
    return value;
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback when used outside provider — returns English passthrough.
    return {
      lang: "en",
      setLang: () => {},
      t: (key: string, params?: Record<string, string | number>) => {
        let value = EN[key] ?? key;
        if (params) Object.entries(params).forEach(([k, v]) => { value = value.replace(`{${k}}`, String(v)); });
        return value;
      },
    };
  }
  return ctx;
}
